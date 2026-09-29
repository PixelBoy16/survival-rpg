import test from 'node:test';
import assert from 'node:assert/strict';
import { World, TICK_RATE, walkable } from '../packages/game-rules/src/index.js';
import { ClientMessage } from '../packages/protocol/src/index.js';

test('protocol rejects teleports, forged damage, non-finite vectors and wrong versions', () => {
  for (const packet of [ { type:'move', seq:1, x:2, y:0 }, { type:'move', seq:1, x:1, y:1 }, { type:'move', seq:1, x:NaN, y:0 }, { type:'move', seq:1, x:0, y:0, position:999 }, { type:'attack', seq:1, target:'infected_1', damage:999 }, { type:'hello', version:99 } ]) assert.equal(ClientMessage.safeParse(packet).success, false);
});
test('fixed speed, stale input stop, normalized diagonals, collision and bounds', () => {
  const w = new World(), p = w.addPlayer('player_test');
  w.intent(p.id, { type:'move', seq:1, x:1, y:0 });
  for (let i=0;i<TICK_RATE;i++) w.step();
  assert.ok(Math.abs(p.x - (5 + 6 * 3.6 / TICK_RATE)) < .001);
  p.x=8.6; p.y=5;
  for (let i=0;i<40;i++) { w.intent(p.id, { type:'move',seq:i+2,x:1,y:0 }); w.step(); }
  assert.ok(p.x <= 8.72); assert.ok(walkable(p.x,p.y)); assert.equal(walkable(-1,1),false);
  assert.equal(w.intent(p.id,{type:'move',seq:50,x:100,y:0}),'movement');
});
test('server damage, cooldown, replay rejection, weapon switching cannot reset cooldown', () => {
  const w = new World(), p = w.addPlayer('player_test'); const enemy = w.spawnMonster('shambler',5.7,5);
  assert.equal(w.intent(p.id,{type:'attack',seq:1,target:enemy.id}),undefined); assert.equal(enemy.hp,50);
  assert.equal(w.intent(p.id,{type:'attack',seq:1,target:enemy.id}),'replay');
  w.intent(p.id,{type:'equip',seq:2,weapon:'hatchet'});
  assert.equal(w.intent(p.id,{type:'attack',seq:3,target:enemy.id}),'cooldown');
  for(let i=0;i<18;i++) w.step();
  assert.equal(w.intent(p.id,{type:'attack',seq:4,target:enemy.id}),undefined); assert.equal(enemy.hp,12);
  const other=w.addPlayer('player_other'); assert.equal(w.intent(p.id,{type:'attack',seq:5,target:other.id}),'invalid_target');
});
test('range, line of sight and stamina are authoritative', () => {
  const w=new World(),p=w.addPlayer('player_test'),e=w.spawnMonster('runner',15,15);
  assert.equal(w.intent(p.id,{type:'attack',seq:1,target:e.id}),'range');
  p.x=8.7;p.y=7;e.x=10.3;e.y=7;
  assert.equal(w.intent(p.id,{type:'attack',seq:2,target:e.id}),'range');
  p.x=5;p.y=5;e.x=5.5;e.y=5;p.stamina=0;
  assert.equal(w.intent(p.id,{type:'attack',seq:3,target:e.id}),'stamina');
});
test('kill creates server-owned loot; atomic pickup, duplicate and ownership protection', () => {
  const w=new World(),p=w.addPlayer('player_test'),other=w.addPlayer('player_other'),e=w.spawnMonster('runner',5.6,5);e.hp=25;
  w.intent(p.id,{type:'attack',seq:1,target:e.id});
  const loot=[...w.entities.values()].find(e=>e.kind==='loot')!;assert.ok(loot);assert.equal(loot.owner,p.id);
  assert.equal(w.intent(other.id,{type:'interact',seq:1,target:loot.id}),'ownership');
  assert.equal(w.intent(p.id,{type:'interact',seq:2,target:loot.id}),undefined);assert.equal(p.scrap,3);
  assert.equal(w.intent(p.id,{type:'interact',seq:2,target:loot.id}),'replay');
  assert.equal(w.intent(p.id,{type:'interact',seq:3,target:loot.id}),'target');assert.equal(p.scrap,3);
});
test('container limited stock and bandage consumption cannot be replayed', () => {
  const w=new World(),p=w.addPlayer('player_test');
  for(let seq=1;seq<=3;seq++) assert.equal(w.intent(p.id,{type:'interact',seq,target:'container_supply'}),undefined);
  assert.equal(w.intent(p.id,{type:'interact',seq:4,target:'container_supply'}),'empty');assert.equal(p.bandages,5);
  p.hp=10;w.intent(p.id,{type:'heal',seq:5});assert.equal(p.hp,50);assert.equal(p.bandages,4);
  assert.equal(w.intent(p.id,{type:'heal',seq:5}),'replay');assert.equal(w.intent(p.id,{type:'heal',seq:6}),'heal_unavailable');
});
test('dead players cannot act or respawn early', () => {
  const w=new World(),p=w.addPlayer('player_test');p.hp=1;w.spawnMonster('runner',5.5,5);w.step();
  assert.equal(p.hp,0);assert.equal(w.intent(p.id,{type:'heal',seq:1}),'dead');assert.equal(w.intent(p.id,{type:'respawn',seq:2}),'respawn_unavailable');
  for(let i=0;i<60;i++)w.step();assert.equal(w.intent(p.id,{type:'respawn',seq:3}),undefined);assert.equal(p.hp,100);
});
test('loot unlocks, expires and infected repopulate without unbounded corpses', () => {
  const w=new World(),p=w.addPlayer('player_test'),other=w.addPlayer('player_other'),e=w.spawnMonster('runner',5.6,5);e.hp=25;
  w.intent(p.id,{type:'attack',seq:1,target:e.id});const loot=[...w.entities.values()].find(e=>e.kind==='loot')!;
  for(let i=0;i<200;i++)w.step();
  assert.equal(w.entities.has(e.id),false);assert.equal(w.intent(other.id,{type:'interact',seq:1,target:loot.id}),undefined);assert.equal(other.scrap,3);
  const spawned=w.spawnMonster('runner',5.6,5);spawned.hp=25;p.stamina=100;
  w.intent(p.id,{type:'attack',seq:2,target:spawned.id});const expiring=[...w.entities.values()].find(e=>e.kind==='loot')!;
  for(let i=0;i<1200;i++)w.step();
  assert.equal(w.entities.has(expiring.id),false);assert.equal([...w.entities.values()].filter(e=>e.kind==='runner').length,3);
});
