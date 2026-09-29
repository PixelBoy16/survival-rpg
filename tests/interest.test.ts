import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialIndex,interestDelta,publicEntity } from '../apps/game-server/src/interest.js';
import { simulationRate } from '../apps/game-server/src/config.js';
import { Game } from '../packages/game-rules/src/game.js';
import { World } from '../packages/game-rules/src/index.js';

test('spatial subscriptions emit enter/leave, exclude other maps and hide other inventories',()=>{
  const g=new Game(),a=g.addPlayer('player_viewer'),b=g.addPlayer('player_near'),far=g.addPlayer('player_far');b.x=7;far.x=23;far.y=23;b.progress!.bankedScrap=999;
  const index=new SpatialIndex(),state={records:new Map<string,string>(),lastSent:new Map<string,number>()};index.rebuild(g.entities.values());
  const first=interestDelta(index,a,state,0);assert.ok(first.upsert.some(e=>e.id===a.id&&e.progress));assert.ok(first.upsert.some(e=>e.id===b.id&&!e.progress));assert.ok(!first.upsert.some(e=>e.id===far.id));
  assert.equal(publicEntity(b,a.id).scrap,0);assert.equal(publicEntity(b,a.id).progress,undefined);
  assert.equal(interestDelta(index,a,state,1).upsert.length,0);
  b.x=23;b.y=23;index.rebuild(g.entities.values());assert.deepEqual(interestDelta(index,a,state,2).remove,[b.id]);
  b.x=6;b.y=5;b.mapId='forest';index.rebuild(g.entities.values());assert.equal(index.query(a).some(e=>e.id===b.id),false);
});
test('distant changed actors are throttled, while the local player is immediate',()=>{
  const g=new Game(),a=g.addPlayer('player_a'),b=g.addPlayer('player_b');b.x=12;
  const index=new SpatialIndex(),state={records:new Map<string,string>(),lastSent:new Map<string,number>()};index.rebuild(g.entities.values());interestDelta(index,a,state,0);
  b.hp=90;a.hp=80;assert.deepEqual(interestDelta(index,a,state,1).upsert.map(e=>e.id),[a.id]);
  assert.ok(interestDelta(index,a,state,4).upsert.some(e=>e.id===b.id&&e.hp===90));
});
test('10/15/20 Hz maintain per-second movement and reject unsupported configuration',()=>{
  for(const rate of [10,15,20] as const){
    assert.equal(simulationRate(String(rate)),rate);const world=new World(),p=world.addPlayer('player_clock');
    for(let i=0;i<rate;i++){world.intent(p.id,{type:'move',seq:i+1,x:0,y:-1});world.step(20/rate);}
    assert.ok(Math.abs(p.y-1.4)<1e-6,`${rate} Hz moved to ${p.y}`);
    assert.ok(Math.abs(world.tick-20)<1e-6);
  }
  assert.throws(()=>simulationRate('0'));assert.throws(()=>simulationRate('NaN'));assert.throws(()=>simulationRate('60'));
});
