import test from 'node:test';
import assert from 'node:assert/strict';
import { Joystick, screenDirection, screenToWorld } from '../apps/web-client/src/controls.js';
import { World, TICK_RATE, walkable } from '../packages/game-rules/src/index.js';
import { findPath, clearSegment } from '../packages/game-rules/src/navigation.js';
import { ClientMessage } from '../packages/protocol/src/index.js';

test('mouse coordinates invert translated and zoomed isometric camera',()=>{
  const x=12.25,y=7.75,zoom=1.7;
  const p=screenToWorld((x-y)*32*zoom+150,(x+y)*16*zoom-320,150,-320,zoom);
  assert.ok(Math.abs(p.x-x)<1e-9 && Math.abs(p.y-y)<1e-9);
});
test('joystick preserves analog speed, clamps drag and isolates a second action finger',()=>{
  const stick=new Joystick();assert.equal(stick.start(1),true);assert.equal(stick.start(2),false);
  stick.update(1,21,0,42);const half=screenDirection(stick.x,stick.y);assert.ok(Math.abs(Math.hypot(half.x,half.y)-.5)<1e-9);
  stick.update(2,-42,0,42);assert.equal(stick.x,.5);stick.release(2);assert.equal(stick.pointer,1);
  stick.update(1,200,200,42);const clamped=screenDirection(stick.x,stick.y);assert.ok(Math.hypot(clamped.x,clamped.y)<=1.000001);
  stick.release(1);assert.equal(stick.x,0);assert.equal(stick.y,0);assert.equal(stick.pointer,undefined);
  stick.start(3);stick.update(3,1,1,42);assert.equal(stick.x,0);stick.reset();assert.equal(stick.pointer,undefined);
  assert.ok(Math.hypot(...Object.values(screenDirection(1,1)))<=1.000001);
});
test('server navigation routes around a wall and never exceeds movement speed',()=>{
  const w=new World(),p=w.addPlayer('player_path');
  for(const e of w.entities.values())if(e.kind==='runner'||e.kind==='shambler')w.entities.delete(e.id);
  const goal={x:11,y:5};assert.equal(clearSegment(p,goal),false);assert.ok(findPath(p,goal)!.length>1);
  for(let seq=1;seq<300;seq++) {
    assert.equal(w.intent(p.id,{type:'navigate',seq,...goal}),undefined);
    const before={x:p.x,y:p.y};w.step();
    assert.ok(walkable(p.x,p.y));assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<=3.6/TICK_RATE+.000001);
  }
  assert.ok(Math.hypot(p.x-goal.x,p.y-goal.y)<.001);
});
test('navigation rejects invalid destinations, expires, and cancels on direct input/disconnect',()=>{
  const w=new World(),p=w.addPlayer('player_path');
  assert.equal(w.intent(p.id,{type:'navigate',seq:1,x:9.5,y:7}),'destination');
  assert.equal(ClientMessage.safeParse({type:'navigate',seq:2,x:Infinity,y:5}).success,false);
  w.intent(p.id,{type:'navigate',seq:3,x:7,y:5});for(let i=0;i<10;i++)w.step();
  assert.ok(p.x<=5+6*3.6/TICK_RATE+.001);assert.equal(w.controls.get(p.id)!.goal,undefined);
  w.intent(p.id,{type:'navigate',seq:4,x:7,y:5});w.intent(p.id,{type:'move',seq:5,x:0,y:0});assert.equal(w.controls.get(p.id)!.path,undefined);
  w.intent(p.id,{type:'navigate',seq:6,x:7,y:5});w.stop(p.id);assert.equal(w.controls.get(p.id)!.goal,undefined);
  assert.equal(w.intent(p.id,{type:'navigate',seq:6,x:7,y:5}),'replay');
});
