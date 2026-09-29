import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createPlaytestGateway } from '../apps/game-server/src/playtest.js';
import { createGameServer } from '../apps/game-server/src/server.js';
import { VERSION } from '../packages/protocol/src/index.js';

test('internet gateway gates HTTP and WebSockets, validates origin, and joins two invited players',async()=>{
  const game=createGameServer({port:0,log:()=>{}}),backendPort=await game.listen(),origin='https://test.trycloudflare.com',code='long-random-test-invite',presence:string[]=[];
  const redis={rateLimit:async()=>true,presence:async(id:string)=>{presence.push(id);}};
  const gate=createPlaytestGateway({origin:'https://pending.invalid',code,backendPort,redis,port:0}),port=await gate.listen(),base=`http://127.0.0.1:${port}`;
  gate.setOrigin(origin);
  const clients:WebSocket[]=[];
  async function denied(headers:Record<string,string>){
    const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{headers});clients.push(ws);
    await new Promise<void>((yes,no)=>{ws.once('unexpected-response',(_req,res)=>{assert.equal(res.statusCode,403);res.resume();ws.terminate();yes();});ws.on('error',()=>{});ws.once('open',()=>no(Error('Unauthorized socket opened')));});
  }
  try {
    const formResponse=await fetch(base);
    // no-referrer turns a browser form POST's Origin into null, breaking this gate.
    assert.equal(formResponse.headers.get('referrer-policy'),'same-origin');
    assert.match(await formResponse.text(),/Enter the invite code/);
    assert.equal((await fetch(`${base}/join`,{method:'POST',body:'code=wrong'})).status,403);
    assert.equal((await fetch(`${base}/join`,{method:'POST',headers:{Origin:'https://evil.example'},body:`code=${code}`})).status,403);
    assert.equal((await fetch(`${base}/join`,{method:'POST',headers:{Origin:'null'},body:`code=${code}`})).status,403);
    const join=await fetch(`${base}/join`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:`code=${code}`,redirect:'manual'});assert.equal(join.status,303);
    const cookie=join.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);const auth=cookie.split(';')[0];
    await denied({Origin:origin});await denied({Origin:'https://evil.example',Cookie:auth});await denied({Origin:origin,Cookie:auth+'tampered'});
    assert.equal((await fetch(`${base}/package.json`,{headers:{Cookie:auth}})).status,404);
    const ids=await Promise.all([1,2].map(async()=>{
      const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`,{headers:{Origin:origin,Cookie:auth}});clients.push(ws);
      return new Promise<string>((yes,no)=>{ws.on('error',no);ws.once('open',()=>ws.send(JSON.stringify({type:'hello',version:VERSION})));ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='welcome')yes(m.playerId);});});
    }));assert.notEqual(ids[0],ids[1]);assert.deepEqual(new Set(presence),new Set(ids));
  }finally{for(const ws of clients)ws.terminate();await gate.close();await game.close();}
});

test('internet invite login fails closed on Redis outage and rate limit',async()=>{
  let fail=false;const redis={rateLimit:async()=>{if(fail)throw Error('offline');return false;},presence:async()=>{}};
  const gate=createPlaytestGateway({origin:'https://test.trycloudflare.com',code:'long-random-test-invite',backendPort:1,redis,port:0});const port=await gate.listen();
  try {const login=()=>fetch(`http://127.0.0.1:${port}/join`,{method:'POST',body:'code=long-random-test-invite',redirect:'manual'});assert.equal((await login()).status,429);fail=true;assert.equal((await login()).status,503);}
  finally{await gate.close();}
});

test('playtest gateways reserve different free ports while an existing host is running',async()=>{
  const options={origin:'https://pending.invalid',code:'long-random-test-invite',backendPort:1,redis:{rateLimit:async()=>true,presence:async()=>{}},port:0};
  const first=createPlaytestGateway(options),second=createPlaytestGateway(options);
  try {const a=await first.listen(),b=await second.listen();assert.ok(a>0&&b>0);assert.notEqual(a,b);}
  finally{await first.close();await second.close();}
});
