import { Game } from '../packages/game-rules/src/game.js';
import { SpatialIndex,interestDelta,publicEntity } from '../apps/game-server/src/interest.js';
const game=new Game(),players=Array.from({length:50},(_,i)=>game.addPlayer(`player_${i}`));
for(let i=0;i<players.length;i++){players[i].x=1+(i%10)*2.2;players[i].y=1+Math.floor(i/10)*4.4;}
const index=new SpatialIndex(),states=players.map(()=>({records:new Map<string,string>(),lastSent:new Map<string,number>()})),baseline=players.map(()=>new Map<string,string>());
let aoi=0,naive=0,visible=0;
for(let tick=0;tick<400;tick++){
  // Deterministic replication-only workload; simulation/movement validity is tested separately.
  players.forEach((p,i)=>{p.facing=(tick+i)%360;});index.rebuild(game.entities.values());
  for(let i=0;i<players.length;i++){
    const result=interestDelta(index,players[i],states[i],tick);visible+=result.visible;
    aoi+=Buffer.byteLength(JSON.stringify({type:'delta',tick,upsert:result.upsert,remove:result.remove}));
    const changed=game.visible(players[i].id).map(e=>publicEntity(e,players[i].id)).filter(e=>{const raw=JSON.stringify(e);if(baseline[i].get(e.id)===raw)return false;baseline[i].set(e.id,raw);return true;});
    naive+=Buffer.byteLength(JSON.stringify({type:'delta',tick,upsert:changed,remove:[]}));
  }
}
console.log(JSON.stringify({scenario:'50 dispersed town actors, changed facing, 20 seconds',aoiBytesPerPlayerSecond:aoi/50/20,fullMapDeltaBytesPerPlayerSecond:naive/50/20,reductionPercent:(1-aoi/naive)*100,meanVisibleEntities:visible/50/400,note:'Equal privacy filtering on both paths; logical payload bytes, not transport framing.'}));
