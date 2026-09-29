import { performance } from 'node:perf_hooks';
import { World } from '../packages/game-rules/src/index.js';
for (const count of [2,50]) {
  const world=new World(); const players=Array.from({length:count},(_,i)=>world.addPlayer(`player_bench-${i}`));
  const samples:number[]=[];let bytes=0;
  for(let step=0;step<12000;step++) {
    const started=performance.now();
    for(const p of players) {
      const seq=(world.controls.get(p.id)?.seq??0)+1;
      if(p.hp===0)world.intent(p.id,{type:'respawn',seq});
      else world.intent(p.id,{type:'move',seq,x:step%80<40?1:-1,y:0});
    }
    world.step();bytes+=JSON.stringify([...world.entities.values()]).length;samples.push(performance.now()-started);
  }
  samples.sort((a,b)=>a-b);
  console.log(JSON.stringify({players:count,simulatedSeconds:600,ticks:world.tick,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],maxMs:samples.at(-1),serializedMB:bytes/1e6,entities:world.entities.size}));
}
