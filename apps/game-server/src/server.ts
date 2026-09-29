import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessage, VERSION, type ServerMessage } from '../../../packages/protocol/src/index.js';
import { TICK_RATE } from '../../../packages/game-rules/src/index.js';
import { Game } from '../../../packages/game-rules/src/game.js';
import { SpatialIndex,interestDelta,publicEntity,type InterestState } from './interest.js';
import { simulationRate } from './config.js';
interface Session { interest:InterestState; token: string; playerId: string; socket?: WebSocket; expires: number }
export function createGameServer(options: { port?: number; host?: string; simulationHz?:10|15|20; log?: (event: string, data: object) => void } = {}) {
  const log = options.log ?? ((event, data) => console.log(JSON.stringify({ time: new Date().toISOString(), event, ...data })));
  const world = new Game(log), sessions = new Map<string, Session>(),spatial=new SpatialIndex();
  const hz=simulationRate(options.simulationHz??process.env.SIMULATION_HZ);
  const metrics = { rejected: 0, connections: 0, tickMs: 0, maxTickMs: 0, bytesOut: 0,simulationHz:hz,aoiEntities:0,replicationPackets:0 };
  const http = createServer((req, res) => { if (req.url !== '/health') { res.writeHead(404).end(); return; } res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ status: 'ok', version: VERSION, tick: world.tick, players: sessions.size, entities: world.entities.size, ...metrics })); });
  const wss = new WebSocketServer({ server: http, path: '/socket', maxPayload: 2048, perMessageDeflate: false });
  const send = (ws: WebSocket, message: ServerMessage) => { if (ws.readyState !== WebSocket.OPEN) return; if (ws.bufferedAmount > 128 * 1024) { ws.close(1013, 'Slow consumer'); return; } const raw = JSON.stringify(message); metrics.bytesOut += Buffer.byteLength(raw); ws.send(raw); };
  const reject = (ws: WebSocket, reason: string) => { metrics.rejected++; send(ws, { type: 'reject', reason }); };
  wss.on('connection', (ws, req) => {
    // Local development is deliberately loopback-only. Also reject browser cross-origin access.
    if (req.headers.origin && !['http://127.0.0.1:5173', 'http://localhost:5173'].includes(req.headers.origin)) { ws.close(1008, 'Origin'); return; }
    if (wss.clients.size > 100) { ws.close(1013, 'Capacity'); return; }
    metrics.connections++;
    let session: Session | undefined, allowance = 80, last = performance.now(), strikes = 0;
    const helloTimeout = setTimeout(() => ws.close(1008, 'Hello required'), 5000);
    ws.on('error', error => log('socket_error', { message: error.message }));
    ws.on('message', (raw, binary) => {
      const now = performance.now(); allowance = Math.min(80, allowance + (now - last) * 0.04); last = now;
      if (allowance < 1) { reject(ws, 'rate_limit'); if (++strikes > 10) ws.close(1008, 'Rate limit'); return; } allowance--;
      let input: unknown;
      try { if (binary) throw Error('binary'); input = JSON.parse(raw.toString()); } catch { reject(ws, 'malformed'); return; }
      const parsed = ClientMessage.safeParse(input);
      if (!parsed.success) { reject(ws, 'schema'); return; }
      const msg = parsed.data;
      if (msg.type === 'hello') {
        if (session) { reject(ws, 'already_joined'); return; }
        if (msg.token) { session = sessions.get(msg.token); if (!session || session.expires < now) { reject(ws, 'session_expired'); ws.close(1008, 'Expired'); return; } }
        else {
          if (sessions.size >= 100) { ws.close(1013, 'Capacity'); return; }
          session = { interest:{records:new Map(),lastSent:new Map()},token: randomUUID(), playerId: `player_${randomUUID()}`, expires: Infinity }; sessions.set(session.token, session); world.addPlayer(session.playerId);
        }
        const previous = session.socket; session.socket = ws; session.expires = Infinity; previous?.close(1008, 'Session replaced'); clearTimeout(helloTimeout);
        spatial.rebuild(world.entities.values());session.interest={records:new Map(),lastSent:new Map()};
        const viewer=world.entities.get(session.playerId)!;
        send(ws, { type: 'welcome', version: VERSION, token: session.token, playerId: session.playerId, seq: world.controls.get(session.playerId)!.seq, tick: world.tick, entities: spatial.query(viewer).map(e=>publicEntity(e,viewer.id)) }); log('session_join', { playerId: session.playerId }); return;
      }
      if (!session || session.socket !== ws) { reject(ws, 'session'); return; }
      if (msg.type === 'ping') { send(ws, { type: 'pong', sent: msg.sent }); return; }
      const error = world.intent(session.playerId, msg); if (error) reject(ws, error);
    });
    ws.on('close', () => { clearTimeout(helloTimeout); if (session?.socket === ws) { session.socket = undefined; session.expires = performance.now() + 30000; world.stop(session.playerId); log('session_disconnect', { playerId: session.playerId }); } });
  });
  let next = performance.now(),lastSecond=-1,lastMetrics=-1;
  const timer = setInterval(() => {
    const start = performance.now(); let steps = 0;
    while (start >= next && steps < 5) { world.step(TICK_RATE/hz); next += 1000 / hz; steps++; }
    if (steps === 5 && start >= next) { next = start + 1000 / hz; log('tick_overrun', {}); }
    if (!steps) return;
    for (const [token, s] of sessions) if (!s.socket && s.expires <= start) { world.removePlayer(s.playerId); sessions.delete(token); }
    const all=world.entities;spatial.rebuild(all.values());const second=Math.floor(world.tick/TICK_RATE);metrics.aoiEntities=0;
    for (const session of sessions.values()) {
      if(!session.socket)continue;
      const viewer=all.get(session.playerId)!;
      const delta=interestDelta(spatial,viewer,session.interest,world.tick);metrics.aoiEntities+=delta.visible;
      if(delta.upsert.length||delta.remove.length||second!==lastSecond){send(session.socket,{type:'delta',tick:world.tick,upsert:delta.upsert,remove:delta.remove});metrics.replicationPackets++;}
      if(second!==lastSecond)send(session.socket,world.activity(session.playerId));
    }
    metrics.tickMs = performance.now() - start; metrics.maxTickMs = Math.max(metrics.maxTickMs, metrics.tickMs);
    lastSecond=second;
    if (Math.floor(second/10)!==lastMetrics){lastMetrics=Math.floor(second/10);log('metrics', { ...metrics, players: sessions.size, tick: world.tick });}
  }, 10);
  return { world, metrics, listen: () => new Promise<number>((resolve, reject) => { http.once('error', reject); http.listen(options.port ?? 3001, options.host ?? '127.0.0.1', () => { const address = http.address(); resolve(typeof address === 'object' && address ? address.port : 3001); }); }), close: async () => { clearInterval(timer); for (const ws of wss.clients) ws.terminate(); await new Promise<void>(resolve => wss.close(() => http.close(() => resolve()))); } };
}
