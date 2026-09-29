import { WebSocket } from 'ws';
import { performance } from 'node:perf_hooks';
import { createGameServer } from '../apps/game-server/src/server.js';
import { VERSION,type ServerMessage } from '../packages/protocol/src/index.js';
import { simulationRate } from '../apps/game-server/src/config.js';
const count=Number(process.env.CLIENTS??50),seconds=Number(process.env.DURATION_SECONDS??10),hz=simulationRate(process.env.SIMULATION_HZ);
if(!Number.isInteger(count)||count<1||count>100||!Number.isFinite(seconds)||seconds<2||seconds>3600)throw Error('Local single-town harness supports 1–100 clients and 2–3600 seconds. The larger ladder requires channel allocation.');
const server=createGameServer({port:0,simulationHz:hz,log:()=>{}}),port=await server.listen();
const allSockets:WebSocket[]=[];
let bytesIn=0,bytesOut=0,packets=0,rejections=0;
interface Client {ws:WebSocket;token:string;id:string;seq:number}
async function join(token?:string):Promise<Client> {
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`);allSockets.push(ws);const timeout=setTimeout(()=>reject(Error('Join timeout')),5000);
    ws.on('error',error=>{clearTimeout(timeout);reject(error);});
    ws.on('open',()=>{const raw=JSON.stringify({type:'hello',version:VERSION,...(token?{token}:{})});bytesIn+=Buffer.byteLength(raw);ws.send(raw);});
    ws.on('message',raw=>{const data=Buffer.isBuffer(raw)?raw:Array.isArray(raw)?Buffer.concat(raw):Buffer.from(raw);bytesOut+=data.byteLength;packets++;const message=JSON.parse(data.toString()) as ServerMessage;if(message.type==='reject')rejections++;if(message.type==='welcome'){clearTimeout(timeout);resolve({ws,token:message.token,id:message.playerId,seq:message.seq});}});
  });
}
let timer:ReturnType<typeof setInterval>|undefined;
try {
  const clients=await Promise.all(Array.from({length:count},()=>join()));
  const cpu=process.cpuUsage(),start=performance.now();
  timer=setInterval(()=>{for(let i=0;i<clients.length;i+=5){const c=clients[i];if(c.ws.readyState!==WebSocket.OPEN)continue;const raw=JSON.stringify({type:'move',seq:++c.seq,x:0,y:Math.floor((performance.now()-start)/1500)%2?.5:-.5});bytesIn+=Buffer.byteLength(raw);c.ws.send(raw);}},100);
  await new Promise(r=>setTimeout(r,seconds*1000));clearInterval(timer);
  const aoiEntitiesTotal=server.metrics.aoiEntities;
  for(const c of clients)c.ws.close();
  await new Promise(r=>setTimeout(r,100));const resumed=await Promise.all(clients.map(c=>join(c.token)));
  const reconnects=resumed.filter((c,i)=>c.id===clients[i].id).length;
  const elapsed=(performance.now()-start)/1000,usage=process.cpuUsage(cpu),memory=process.memoryUsage();
  console.log(JSON.stringify({scenario:'dense town, 20% moving, all reconnect',clients:count,simulationHz:hz,elapsedSeconds:elapsed,reconnects,rejections,bytesOutPerPlayerSecond:bytesOut/count/elapsed,bytesInPerPlayerSecond:bytesIn/count/elapsed,packetsPerPlayerSecond:packets/count/elapsed,combinedProcessCpuPercent:(usage.user+usage.system)/(elapsed*1e4),combinedProcessRSS:memory.rss,maxServerUpdateMs:server.metrics.maxTickMs,aoiEntitiesTotal,note:'Local server and load generator share one process; not an AWS safe-CCU benchmark.'}));
  if(reconnects!==count||rejections)process.exitCode=1;
} finally {if(timer)clearInterval(timer);for(const ws of allSockets)ws.terminate();await server.close();}
