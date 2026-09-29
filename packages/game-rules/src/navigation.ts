import { MAP, PLAYER } from '../../content-schema/src/index.js';
export interface Point { x: number; y: number }
export function walkable(x: number, y: number, map = MAP) {
  const r = PLAYER.radius;
  return Number.isFinite(x) && Number.isFinite(y) && x >= r && y >= r && x <= map.width - r && y <= map.height - r && !map.walls.some(w => x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h);
}
export function clearSegment(a: Point, b: Point, map = MAP) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.05));
  for (let i=0;i<=steps;i++) if (!walkable(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,map)) return false;
  return true;
}
// Bounded four-neighbor search on the static tile grid. No corner cutting.
export function findPath(start: Point, goal: Point, map = MAP): Point[] | undefined {
  if (!walkable(start.x,start.y,map) || !walkable(goal.x,goal.y,map)) return;
  if (clearSegment(start,goal,map)) return [{...goal}];
  const key = (p: Point) => Math.floor(p.y)*map.width+Math.floor(p.x);
  const center = (id: number) => ({x:id%map.width+.5,y:Math.floor(id/map.width)+.5});
  const first=key(start), last=key(goal), queue=[first], previous=new Map<number,number>([[first,-1]]);
  if (!clearSegment(start,center(first),map) || !clearSegment(center(last),goal,map)) return;
  for (let index=0;index<queue.length;index++) {
    const id=queue[index], p=center(id);
    if (id===last) {
      const path: Point[]=[{...goal}];
      for(let at=id;at!==-1;at=previous.get(at)!) path.unshift(center(at));
      return path;
    }
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next={x:p.x+dx,y:p.y+dy}, nextId=key(next);
      if (!previous.has(nextId) && clearSegment(p,next,map)) { previous.set(nextId,id);queue.push(nextId); }
    }
  }
}
