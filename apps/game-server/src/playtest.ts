import { createServer, type IncomingMessage } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { Coordination } from '../../../packages/persistence/src/redis.js';

const form='<!doctype html><meta name="viewport" content="width=device-width"><title>LAST HAVEN playtest</title><h1>LAST HAVEN playtest</h1><p>Enter the invite code from your host.</p><form method="post" action="/join"><label>Invite code <input name="code" type="password" required maxlength="128" autocomplete="off"></label><button>Join game</button></form>';
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function createPlaytestGateway(options:{origin:string;code:string;backendPort:number;redis:Pick<Coordination,'rateLimit'|'presence'>;root?:string;port?:number}) {
  let origin=new URL(options.origin).origin;
  if(options.code.length<16)throw Error('Playtest invite code must have at least 16 characters');
  const key=randomBytes(32),root=resolve(options.root??'dist/client');
  const sign=(s:string)=>createHmac('sha256',key).update(s).digest('hex');
  function authorized(req:IncomingMessage){
    const value=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('haven-playtest='))?.slice(15);
    if(!value)return false;
    const [nonce,expiry,signature]=value.split('.');
    return !!nonce&&!!signature&&Number(expiry)>Date.now()&&equal(sign(`${nonce}.${expiry}`),signature);
  }
  const server=createServer((req,res)=>{void (async()=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'");
    if(req.url==='/join'&&req.method==='POST') {
      if(req.headers.origin&&req.headers.origin!==origin){res.writeHead(403).end('Origin rejected');return;}
      const address=String(req.headers['cf-connecting-ip']??req.socket.remoteAddress).slice(0,100);
      const subject=createHash('sha256').update(address).digest('hex');
      if(!await options.redis.rateLimit(`login_${subject}`,10,60)||!await options.redis.rateLimit('playtest_login_global',120,60)){res.writeHead(429).end('Try again in a minute');return;}
      let body='';for await(const chunk of req){body+=String(chunk);if(Buffer.byteLength(body)>1024){res.writeHead(413).end();req.destroy();return;}}
      if(!equal(new URLSearchParams(body).get('code')??'',options.code)){res.writeHead(403).end('Invalid invite code');return;}
      const token=`${randomBytes(24).toString('hex')}.${Date.now()+12*3600*1000}`;
      res.setHeader('Set-Cookie',`haven-playtest=${token}.${sign(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
      res.writeHead(303,{Location:'/'}).end();return;
    }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
    if(!authorized(req)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(form);return;}
    const path=new URL(req.url??'/',origin).pathname;
    const relative=path==='/'?'index.html':/^\/assets\/[a-zA-Z0-9_.-]+$/.test(path)?path.slice(1):undefined;
    if(!relative){res.writeHead(404).end();return;}
    try {const content=await readFile(resolve(root,relative));const ext=relative.split('.').pop();res.setHeader('Content-Type',ext==='html'?'text/html; charset=utf-8':ext==='js'?'text/javascript':ext==='css'?'text/css':'application/octet-stream');res.end(req.method==='HEAD'?undefined:content);}
    catch {res.writeHead(404).end('Build the game first');}
  })().catch(()=>{if(!res.headersSent)res.writeHead(503);res.end('Playtest service unavailable');});});
  server.requestTimeout=10000;server.headersTimeout=10000;
  const sockets=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head)=>{
    // Raw upgrade sockets are no longer managed by http; a client reset must not crash the host.
    socket.on('error',()=>socket.destroy());
    if(req.url!=='/socket'||req.headers.origin!==origin||!authorized(req)||sockets.clients.size>=100){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    sockets.handleUpgrade(req,socket,head,client=>{
      const upstream=new WebSocket(`ws://127.0.0.1:${options.backendPort}/socket`);
      let queued:{data:Buffer;binary:boolean}[]=[],playerId:string|undefined;
      const stop=()=>{client.close(1013,'Connection unavailable');upstream.terminate();};
      const timer=setInterval(()=>{if(playerId)void options.redis.presence(playerId,'local-playtest').catch(stop);},15000);
      client.on('error',()=>upstream.terminate());upstream.on('error',stop);
      client.on('close',()=>{clearInterval(timer);upstream.terminate();});upstream.on('close',()=>client.close());
      client.on('message',(data,binary)=>{
        const buffer=Buffer.isBuffer(data)?data:Array.isArray(data)?Buffer.concat(data):Buffer.from(data);
        if(upstream.readyState===WebSocket.OPEN){if(upstream.bufferedAmount>128*1024){stop();return;}upstream.send(buffer,{binary});}
        else if(queued.length<8)queued.push({data:buffer,binary});else stop();
      });
      upstream.on('open',()=>{for(const message of queued)upstream.send(message.data,{binary:message.binary});queued=[];});
      upstream.on('message',(data,binary)=>{
        if(client.readyState!==WebSocket.OPEN)return;
        if(client.bufferedAmount>128*1024){stop();return;}
        try {const message=JSON.parse(data.toString()) as {type:string;playerId?:string};if(message.type==='welcome'&&message.playerId){playerId=message.playerId;void options.redis.presence(playerId,'local-playtest').catch(stop);}}catch{/* Backend protocol is validated by the game server. */}
        client.send(data,{binary});
      });
    });
  });
  return {setOrigin:(value:string)=>{origin=new URL(value).origin;},listen:()=>new Promise<number>((yes,no)=>{server.once('error',no);server.listen(options.port??3002,'127.0.0.1',()=>{const a=server.address();yes(typeof a==='object'&&a?a.port:3002);});}),close:async()=>{for(const client of sockets.clients)client.terminate();await new Promise<void>(r=>sockets.close(()=>server.close(()=>r())));}};
}

