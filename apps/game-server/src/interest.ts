import type { Entity } from '../../../packages/shared-types/src/index.js';

/** Rebuilt once per simulation update, shared by all subscribers on a map. */
export class SpatialIndex {
  private cells=new Map<string,Entity[]>();
  constructor(readonly cellSize=4,readonly radius=10) {}
  rebuild(entities:Iterable<Entity>) {
    this.cells.clear();
    for(const entity of entities){const key=this.key(entity.mapId??'',Math.floor(entity.x/this.cellSize),Math.floor(entity.y/this.cellSize));const cell=this.cells.get(key)??[];cell.push(entity);this.cells.set(key,cell);}
  }
  private key(map:string,x:number,y:number){return `${map}:${x}:${y}`;}
  query(viewer:Entity) {
    const result:Entity[]=[];
    const minX=Math.floor((viewer.x-this.radius)/this.cellSize),maxX=Math.floor((viewer.x+this.radius)/this.cellSize);
    const minY=Math.floor((viewer.y-this.radius)/this.cellSize),maxY=Math.floor((viewer.y+this.radius)/this.cellSize);
    for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)for(const e of this.cells.get(this.key(viewer.mapId??'',x,y))??[])
      if(e.id===viewer.id||Math.hypot(e.x-viewer.x,e.y-viewer.y)<=this.radius)result.push(e);
    return result;
  }
}

export function publicEntity(entity:Entity,viewerId:string):Entity {
  if(entity.id===viewerId||entity.kind!=='player')return entity;
  // Party membership and equipped appearance are public; inventory/progression are private.
  return {...entity,progress:undefined,partyId:entity.progress?.party,bandages:0,scrap:0};
}
export interface InterestState {records:Map<string,string>;lastSent:Map<string,number>}
export function interestDelta(index:SpatialIndex,viewer:Entity,state:InterestState,tick:number) {
  const nearby=index.query(viewer),ids=new Set(nearby.map(e=>e.id)),upsert:Entity[]=[],remove:string[]=[];
  for(const id of state.records.keys())if(!ids.has(id)){remove.push(id);state.records.delete(id);state.lastSent.delete(id);}
  for(const raw of nearby){
    const e=publicEntity(raw,viewer.id),serialized=JSON.stringify(e),known=state.records.has(e.id);
    const interval=e.id===viewer.id||Math.hypot(e.x-viewer.x,e.y-viewer.y)<=5?0:4; // base clock ticks: 200 ms at distance
    if(serialized!==state.records.get(e.id)&&(!known||tick-(state.lastSent.get(e.id)??0)>=interval)){
      upsert.push(e);state.records.set(e.id,serialized);state.lastSent.set(e.id,tick);
    }
  }
  return {upsert,remove,visible:nearby.length};
}
