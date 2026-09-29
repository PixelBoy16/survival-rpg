export type MovementMode = 'keyboard' | 'click';
export function screenDirection(right: number, down: number) {
  const magnitude = Math.min(1, Math.hypot(right,down));
  const x=right+down,y=down-right,length=Math.hypot(x,y)||1;
  return {x:x/length*magnitude,y:y/length*magnitude};
}
export function screenToWorld(x: number, y: number, cameraX: number, cameraY: number, scale: number) {
  const sx=(x-cameraX)/scale,sy=(y-cameraY)/scale;
  return {x:sx/64+sy/32,y:sy/32-sx/64};
}
export class Joystick {
  pointer: number | undefined;
  x=0; y=0;
  start(id: number) { if(this.pointer!==undefined)return false;this.pointer=id;return true; }
  update(id: number, x: number, y: number, radius: number) {
    if(id!==this.pointer)return;
    const length=Math.hypot(x,y),scale=Math.max(radius,length);
    this.x=length<radius*.15?0:x/scale;this.y=length<radius*.15?0:y/scale;
  }
  release(id: number) { if(id===this.pointer)this.reset(); }
  reset() {this.pointer=undefined;this.x=0;this.y=0;}
}
