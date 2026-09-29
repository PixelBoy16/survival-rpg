import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../apps/game-server/src/server.js';
import { VERSION, type ServerMessage } from '../packages/protocol/src/index.js';
type Welcome = Extract<ServerMessage,{type:'welcome'}>;
function client(port:number) {
  const ws=new WebSocket(`ws://127.0.0.1:${port}/socket`), queue:ServerMessage[]=[];
  ws.on('message', raw=>queue.push(JSON.parse(raw.toString()) as ServerMessage));
  return { ws, open:()=>new Promise<void>(resolve=>ws.once('open',resolve)), send:(m:object)=>ws.send(JSON.stringify(m)), wait:async <T extends ServerMessage>(predicate:(m:ServerMessage)=>boolean):Promise<T>=>{
    const end=Date.now()+3000;
    while(Date.now()<end){ const index=queue.findIndex(predicate);if(index>=0)return queue.splice(index,1)[0] as T;await new Promise(r=>setTimeout(r,10)); }
    throw Error('Timed out waiting for server packet');
  } };
}
test('two clients join, replicate movement, reject cheats and resume same session with replay protection', async()=>{
  const server=createGameServer({port:0,log:()=>{}});const port=await server.listen();const a=client(port),b=client(port);
  try {
    await Promise.all([a.open(),b.open()]);a.send({type:'hello',version:VERSION});b.send({type:'hello',version:VERSION});
    const wa=await a.wait<Welcome>(m=>m.type==='welcome'),wb=await b.wait<Welcome>(m=>m.type==='welcome');assert.notEqual(wa.playerId,wb.playerId);
    a.send({type:'move',seq:1,x:1,y:0});
    await b.wait(m=>m.type==='delta'&&m.upsert.some(e=>e.id===wa.playerId&&e.x>5));
    a.send({type:'move',seq:2,x:100,y:0});await a.wait(m=>m.type==='reject'&&m.reason==='schema');
    a.send({type:'interact',seq:3,target:'container_supply'});await a.wait(m=>m.type==='delta'&&m.upsert.some(e=>e.id===wa.playerId&&e.bandages===3));
    const closed=new Promise<void>(r=>a.ws.once('close',()=>r()));a.ws.close();await closed;
    const resumed=client(port);await resumed.open();resumed.send({type:'hello',version:VERSION,token:wa.token});
    const wr=await resumed.wait<Welcome>(m=>m.type==='welcome');assert.equal(wr.playerId,wa.playerId);assert.equal(wr.seq,3);assert.equal(wr.entities.find(e=>e.id===wa.playerId)!.bandages,3);
    resumed.send({type:'interact',seq:3,target:'container_supply'});await resumed.wait(m=>m.type==='reject'&&m.reason==='replay');resumed.ws.close();
    const invalid=client(port);await invalid.open();invalid.send({type:'hello',version:VERSION,token:'00000000-0000-4000-8000-000000000000'});await invalid.wait(m=>m.type==='reject'&&m.reason==='session_expired');invalid.ws.close();
  }finally{a.ws.terminate();b.ws.terminate();await server.close();}
});
test('unauthenticated commands, malformed payloads and floods are rejected',async()=>{
  const server=createGameServer({port:0,log:()=>{}});const port=await server.listen();const a=client(port);
  try{await a.open();a.send({type:'move',seq:1,x:0,y:0});await a.wait(m=>m.type==='reject'&&m.reason==='session');a.ws.send('{bad');await a.wait(m=>m.type==='reject'&&m.reason==='malformed');for(let i=0;i<100;i++)a.send({type:'ping',sent:i});await a.wait(m=>m.type==='reject'&&m.reason==='rate_limit');}finally{a.ws.terminate();await server.close();}
});
test('travel replicates destination entities and removes source map entities for both clients',async()=>{
  const server=createGameServer({port:0,log:()=>{}}),port=await server.listen(),a=client(port),b=client(port);
  try{
    await Promise.all([a.open(),b.open()]);a.send({type:'hello',version:VERSION});b.send({type:'hello',version:VERSION});
    const wa=await a.wait<Welcome>(m=>m.type==='welcome');await b.wait<Welcome>(m=>m.type==='welcome');
    await b.wait(m=>m.type==='delta'&&m.upsert.some(e=>e.id===wa.playerId));
    const p=server.world.entities.get(wa.playerId)!;p.x=8;p.y=5;
    a.send({type:'travel',seq:1,portal:'forest'});
    await a.wait(m=>m.type==='delta'&&m.upsert.some(e=>e.id===wa.playerId&&e.mapId==='forest')&&m.remove.includes('container_supply'));
    await b.wait(m=>m.type==='delta'&&m.remove.includes(wa.playerId));
    a.send({type:'interact',seq:2,target:'container_supply'});await a.wait(m=>m.type==='reject'&&m.reason==='target');
  }finally{a.ws.terminate();b.ws.terminate();await server.close();}
});
