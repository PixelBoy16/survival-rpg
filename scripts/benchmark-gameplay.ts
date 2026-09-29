import { performance } from 'node:perf_hooks';
import { Game } from '../packages/game-rules/src/game.js';
for(const count of [2,50]) {
  const game=new Game();
  const players=Array.from({length:count},(_,i)=>game.addPlayer(`player_bench-${i}`));
  for(const p of players){p.x=8;p.y=5;game.intent(p.id,{type:'travel',seq:1,portal:'forest'});p.progress!.checkpoint='forest';}
  const samples:number[]=[];
  for(let i=0;i<12000;i++) {
    const start=performance.now();
    for(const p of players){const seq=game.controls.get(p.id)!.seq+1;const x=i%80<40?1:-1,y=i%160<80?0:.5,length=Math.hypot(x,y);if(p.progress!.dead)game.intent(p.id,{type:'respawn',seq});else if(p.hp>0)game.intent(p.id,{type:'move',seq,x:x/length,y:y/length});}
    game.step();JSON.stringify([...game.entities.values()]);samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);
  console.log(JSON.stringify({scope:'four-map gameplay',players:count,ticks:12000,simulatedSeconds:600,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),entities:game.entities.size}));
}
