import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../packages/game-rules/src/game.js';
import { MAPS, RECOVERY, EVENT_RULES } from '../packages/content-schema/src/world.js';
import { ClientMessage } from '../packages/protocol/src/index.js';
import { isMonster } from '../packages/game-rules/src/index.js';
import { walkable } from '../packages/game-rules/src/navigation.js';
import type { Entity } from '../packages/shared-types/src/index.js';
import type { Intent } from '../packages/protocol/src/index.js';
type Action=Intent extends infer I?I extends Intent?Omit<I,'seq'>:never:never;
const send=(g:Game,p:Entity,m:Action)=>g.intent(p.id,{...m,seq:g.controls.get(p.id)!.seq+1} as Intent);
function travel(g:Game,p:Entity,portal:string){const at=MAPS[p.mapId!].portals.find(v=>v.id===portal)!;p.x=at.x;p.y=at.y;assert.equal(send(g,p,{type:'travel',portal}),undefined);}
function party(g:Game,players:Entity[]){assert.equal(send(g,players[0],{type:'party',action:'create'}),undefined);for(const p of players.slice(1)){assert.equal(send(g,players[0],{type:'party',action:'invite',target:p.id}),undefined);assert.equal(send(g,p,{type:'party',action:'join',target:players[0].progress!.party}),undefined);}}
function step(g:Game,n:number){for(let i=0;i<n;i++)g.step();}

test('content map spawn/resource/portal positions are valid and required metadata exists',()=>{
  for(const map of Object.values(MAPS)){
    assert.ok(walkable(map.spawn.x,map.spawn.y,map));assert.equal(map.pvpPolicy,'disabled');
    for(const p of [...map.spawns,...map.resources,...map.portals])assert.ok(walkable(p.x,p.y,map),`${map.id} ${p.x},${p.y}`);
    for(const portal of map.portals)assert.ok(MAPS[portal.target]);
  }
});
test('town -> forest -> kill/gather -> return -> claim grants progression once',()=>{
  const logs:string[]=[];const g=new Game(e=>logs.push(e)),p=g.addPlayer('player_loop');
  assert.equal(send(g,p,{type:'quest',action:'accept',quest:'supplies'}),undefined);
  assert.equal(send(g,p,{type:'prepare'}),undefined);
  assert.equal(send(g,p,{type:'travel',portal:'forest'}),'portal_range');travel(g,p,'forest');
  const w=g.worldFor(p.id)!;p.x=7;p.y=7;
  assert.equal(send(g,p,{type:'interact',target:'resource_forest-wood'}),undefined);
  assert.equal(send(g,p,{type:'interact',target:'resource_forest-wood'}),undefined);
  p.x=7;p.y=9;
  for(const e of [...w.entities.values()].filter(isMonster)){e.x=7.5;e.y=9;e.hp=25;p.stamina=100;w.controls.get(p.id)!.cooldown=0;assert.equal(send(g,p,{type:'attack',target:e.id}),undefined);}
  assert.deepEqual(p.progress!.quest!.counts,[1,2,3]);assert.equal(p.progress!.xp,40);
  travel(g,p,'haven');assert.equal(p.scrap,0);assert.equal(p.progress!.bankedScrap,4);
  assert.equal(send(g,p,{type:'quest',action:'claim',quest:'supplies'}),undefined);
  assert.equal(p.progress!.level,2);assert.equal(p.progress!.xp,140);assert.equal(p.progress!.bankedScrap,14);assert.equal(p.progress!.protection,1);
  assert.equal(send(g,p,{type:'quest',action:'claim',quest:'supplies'}),'quest_incomplete');
  assert.equal(send(g,p,{type:'quest',action:'accept',quest:'supplies'}),'quest_active');
  assert.ok(logs.includes('zone_exit'));assert.ok(logs.includes('quest_reward'));
});
test('cross-map interaction, forged quest progress, unsafe travel and equipment requirements fail',()=>{
  const g=new Game(),a=g.addPlayer('player_a'),b=g.addPlayer('player_b');travel(g,b,'forest');
  assert.equal(send(g,a,{type:'interact',target:'resource_forest-wood'}),'target');
  assert.equal(send(g,a,{type:'equip',weapon:'rifle'}),'locked');a.progress!.level=2;
  assert.equal(send(g,a,{type:'equip',weapon:'rifle'}),'not_owned');
  assert.equal(ClientMessage.safeParse({type:'quest',seq:1,quest:'supplies',action:'claim',counts:[1,2,3]}).success,false);
  assert.equal(send(g,a,{type:'attack',target:b.id}),'target');
  assert.equal(g.visible(a.id).some(e=>e.id===b.id),false);
});
test('four-slot parties require invitations, credit nearby kills, share drops and reject a fifth member',()=>{
  const g=new Game(),players=Array.from({length:5},(_,i)=>g.addPlayer(`player_${i}`));
  party(g,players.slice(0,4));const pid=players[0].progress!.party!;
  assert.equal(send(g,players[4],{type:'party',action:'join',target:pid}),'party_invite_required');
  assert.equal(send(g,players[0],{type:'party',action:'invite',target:players[4].id}),'party_full');
  for(const p of players.slice(0,4)){travel(g,p,'forest');p.x=7;p.y=9;}
  const w=g.worldFor(players[0].id)!,enemy=w.spawnMonster('shambler',7.5,9);enemy.hp=25;
  assert.equal(send(g,players[0],{type:'attack',target:enemy.id}),undefined);
  for(const p of players.slice(0,4))assert.equal(p.progress!.xp,20);
  const loot=[...w.entities.values()].find(e=>e.kind==='loot')!;
  assert.equal(send(g,players[1],{type:'interact',target:loot.id}),undefined);assert.equal(players[1].scrap,3);
  assert.equal(g.activity(players[0].id).party.length,4);
  send(g,players[0],{type:'party',action:'leave'});assert.equal(g.parties.get(pid)!.leader,players[1].id);
});
test('revive consumes a bandage during downed window and prevents death loss',()=>{
  const g=new Game(),a=g.addPlayer('player_a'),b=g.addPlayer('player_b');party(g,[a,b]);
  b.scrap=20;b.hp=0;g.step();assert.equal(b.progress!.dead,false);
  assert.equal(send(g,b,{type:'respawn'}),'revive_window');
  assert.equal(send(g,a,{type:'revive',target:b.id}),undefined);assert.equal(a.bandages,1);assert.equal(b.hp,35);assert.equal(b.scrap,20);
  assert.equal(send(g,a,{type:'revive',target:b.id}),'revive_unavailable');
});
test('full death removes carried inventory and non-premium equipment; bank, XP and premium items survive',()=>{
  const g=new Game(),p=g.addPlayer('player_death'),s=p.progress!;
  p.scrap=21;s.bankedScrap=45;s.xp=125;s.level=2;s.gear.push({weapon:'rifle',premium:true});s.premiumItems.push({id:'cosmetic_founder',count:1});p.hp=0;g.step();step(g,RECOVERY.downedTicks);
  assert.equal(s.dead,true);assert.equal(p.scrap,0);assert.equal(p.bandages,0);assert.equal(s.ammo,0);assert.equal(s.food,0);assert.equal(s.water,0);assert.equal(p.weapon,'fists');
  assert.deepEqual(s.gear,[{weapon:'rifle',premium:true}]);assert.equal(s.premiumItems[0].count,1);assert.equal(s.xp,125);assert.equal(s.bankedScrap,45);
  assert.equal(send(g,p,{type:'respawn'}),undefined);assert.equal(s.dead,false);assert.equal(p.hp,p.maxHp);
});
test('one protection charge preserves all other inventory and equipment exactly once',()=>{
  const g=new Game(),p=g.addPlayer('player_protected'),s=p.progress!;s.protection=2;p.scrap=21;p.hp=0;g.step();step(g,RECOVERY.downedTicks+20);
  assert.equal(s.protection,1);assert.equal(p.scrap,21);assert.equal(p.weapon,'pipe');assert.equal(s.gear.length,3);assert.equal(s.ammo,30);assert.equal(p.bandages,2);
  step(g,100);assert.equal(s.protection,1);
});
test('survival is gradual, hazards affect route choice, town preparation restores needs',()=>{
  const g=new Game(),p=g.addPlayer('player_survival');travel(g,p,'forest');step(g,200);
  assert.ok(p.progress!.hunger>99);assert.ok(p.progress!.thirst<100);
  assert.equal(send(g,p,{type:'consume',item:'water'}),undefined);assert.equal(p.progress!.water,2);assert.equal(p.progress!.thirst,100);
  p.x=16;p.y=18;step(g,20);assert.ok(p.hp<100);assert.ok(p.progress!.exposure>0);
  travel(g,p,'haven');assert.equal(send(g,p,{type:'prepare'}),undefined);assert.equal(p.hp,p.maxHp);assert.equal(p.progress!.exposure,0);
});
test('public horde tracks two contributors and rewards each once, including defend objective',()=>{
  const g=new Game(),a=g.addPlayer('player_a'),b=g.addPlayer('player_b');
  send(g,a,{type:'quest',action:'accept',quest:'rescue'});travel(g,a,'forest');travel(g,b,'forest');step(g,EVENT_RULES.delayTicks);
  const ev=g.events.get('forest')!;assert.equal(ev.kind,'horde');const w=g.worldFor(a.id)!;
  a.x=b.x=7;a.y=b.y=9;
  let index=0;for(const id of ev.entities){const enemy=w.entities.get(id)!;enemy.x=7.5;enemy.y=9;enemy.hp=25;const p=index++%2?a:b;w.controls.get(p.id)!.cooldown=0;p.stamina=100;send(g,p,{type:'attack',target:id});}
  assert.equal(ev.participants.size,2);assert.equal(ev.complete,true);assert.equal(a.progress!.bankedScrap,5);assert.equal(b.progress!.bankedScrap,5);assert.equal(a.progress!.quest!.counts[2],1);
  g.step();assert.equal(g.events.has('forest'),false);assert.equal(a.progress!.bankedScrap,5);
});
test('supply event entity is protocol-addressable and can only be claimed once',()=>{
  const g=new Game(),p=g.addPlayer('player_supply');travel(g,p,'road');step(g,EVENT_RULES.delayTicks);const ev=g.events.get('road')!;const id=[...ev.entities][0];
  p.x=7;p.y=10;assert.equal(ClientMessage.safeParse({type:'interact',seq:20,target:id}).success,true);
  assert.equal(send(g,p,{type:'interact',target:id}),undefined);assert.equal(p.scrap,8);assert.equal(p.progress!.bankedScrap,5);
  assert.equal(send(g,p,{type:'interact',target:id}),'target');
});
test('skills validate costs/unlocks, stagger enemies, and guard reduces incoming damage',()=>{
  const g=new Game(),p=g.addPlayer('player_skill');travel(g,p,'forest');p.x=7;p.y=9;const w=g.worldFor(p.id)!;
  for(const e of w.entities.values())if(isMonster(e))w.entities.delete(e.id);
  const enemy=w.spawnMonster('shambler',7.5,9);
  assert.equal(send(g,p,{type:'skill',skill:'rally'}),'locked');
  assert.equal(send(g,p,{type:'skill',skill:'bash',target:enemy.id}),undefined);assert.ok(enemy.staggerUntil!>g.tick);
  assert.equal(send(g,p,{type:'skill',skill:'bash',target:enemy.id}),'cooldown');
  step(g,1);assert.equal(enemy.aiState,'stagger');assert.equal(p.hp,100);
  assert.equal(send(g,p,{type:'skill',skill:'guard'}),undefined);step(g,40);assert.ok(p.hp>=97);
});
test('rescue escort advances only with a nearby living guide and completes at checkpoint',()=>{
  const g=new Game(),p=g.addPlayer('player_rescue');send(g,p,{type:'quest',action:'accept',quest:'rescue'});travel(g,p,'road');travel(g,p,'hospital');
  const w=g.worldFor(p.id)!;for(const e of w.entities.values())if(isMonster(e))w.removeEntity(e.id);
  step(g,EVENT_RULES.delayTicks);const ev=g.events.get('hospital')!,npc=w.entities.get([...ev.entities][0])!;
  p.x=7;p.y=10;assert.equal(send(g,p,{type:'interact',target:npc.id}),undefined);
  const original={x:npc.x,y:npc.y};p.x=20;p.y=20;step(g,20);assert.equal(npc.x,original.x);assert.equal(npc.y,original.y);
  p.x=5;p.y=6;step(g,150);assert.equal(ev.complete,true);assert.equal(p.progress!.quest!.counts[1],1);assert.equal(p.progress!.bankedScrap,5);
});
test('survival timer counts only living time in the required map',()=>{
  const g=new Game(),p=g.addPlayer('player_timer');send(g,p,{type:'quest',action:'accept',quest:'relief'});step(g,40);assert.equal(p.progress!.quest!.counts[2],0);
  travel(g,p,'road');step(g,40);assert.equal(p.progress!.quest!.counts[2],2);
  p.hp=0;step(g,40);assert.equal(p.progress!.quest!.counts[2],2);
});
test('premium equipped weapon survives death, while normal equipped weapon cannot be re-equipped after loss',()=>{
  const g=new Game(),p=g.addPlayer('player_premium');p.progress!.gear[0].premium=true;p.hp=0;g.step();step(g,RECOVERY.downedTicks);
  assert.equal(p.weapon,'pipe');assert.deepEqual(p.progress!.gear,[{weapon:'pipe',premium:true}]);send(g,p,{type:'respawn'});
  assert.equal(send(g,p,{type:'equip',weapon:'hatchet'}),'not_owned');
  assert.equal(ClientMessage.safeParse({type:'equip',seq:99,weapon:'hatchet',premium:true}).success,false);
});
test('town safety prevents hostile damage even if a monster is spawned there',()=>{
  const g=new Game(),p=g.addPlayer('player_safe'),w=g.worldFor(p.id)!;const e=w.spawnMonster('elite',5.5,5);
  assert.equal(send(g,p,{type:'attack',target:e.id}),'safe_area');step(g,80);assert.equal(p.hp,100);
});
test('map capacity rejects transfer atomically and never changes the source location',()=>{
  const g=new Game();for(let i=0;i<MAPS.forest.maxPlayers;i++){const p=g.addPlayer(`player_full-${i}`);travel(g,p,'forest');}
  const extra=g.addPlayer('player_extra');extra.x=8;extra.y=5;assert.equal(send(g,extra,{type:'travel',portal:'forest'}),'map_full');assert.equal(extra.mapId,'haven');assert.ok(g.worldFor(extra.id)!.entities.has(extra.id));
});
