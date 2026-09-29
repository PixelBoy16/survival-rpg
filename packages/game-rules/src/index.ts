import { MAP, PLAYER, WEAPONS, INFECTED, SKILLS } from '../../content-schema/src/index.js';
import type { MapDefinition } from '../../content-schema/src/world.js';
import type { Entity, MonsterKind } from '../../shared-types/src/index.js';
import type { Intent } from '../../protocol/src/index.js';
import { walkable, findPath, type Point } from './navigation.js';
export { walkable } from './navigation.js';
export const TICK_RATE = 20;
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
export function move(entity: Entity, x: number, y: number, speed: number, map = MAP, delta = 1) {
  const nx = entity.x + x * speed / TICK_RATE * delta, ny = entity.y + y * speed / TICK_RATE * delta;
  if (walkable(nx, entity.y,map)) entity.x = nx;
  if (walkable(entity.x, ny,map)) entity.y = ny;
}
interface Control { x: number; y: number; until: number; cooldown: number; healAt: number; seq: number; respawnAt: number; goal?: Point; path?: Point[] }
export class World {
  tick = 0;
  entities = new Map<string, Entity>();
  controls = new Map<string, Control>();
  private serial = 0;
  private monsterAttack = new Map<string, number>();
  private respawns: { tick: number; kind: MonsterKind; x: number; y: number }[] = [];
  private threat = new Map<string,Map<string,number>>();
  private homes = new Map<string,{x:number;y:number}>();
  constructor(private audit: (event: string, data: object) => void = () => {}, readonly map: typeof MAP | MapDefinition = MAP) {
    if('spawns' in map) for(const spawn of map.spawns)this.spawnMonster(spawn.kind,spawn.x,spawn.y);
    else {this.spawnMonster('shambler', 7, 12); this.spawnMonster('runner', 12, 10);}
    const id=map.id===MAP.id||map.id==='haven'?'container_supply':`container_${map.id}`;
    this.entities.set(id, { ...this.base(id, 'container', 6, 5, 1), bandages: 3 });
  }
  private base(id: string, kind: Entity['kind'], x: number, y: number, hp: number): Entity { return { id, kind, x, y, hp, maxHp: hp, stamina: 100, facing: 0, animation: 'idle', weapon: 'pipe', bandages: 0, scrap: 0, mapId:this.map.id }; }
  addPlayer(id: string) { const p = { ...this.base(id, 'player', MAP.spawn.x, MAP.spawn.y, PLAYER.hp), bandages: 2 }; this.entities.set(id, p); this.controls.set(id, { x: 0, y: 0, until: 0, cooldown: 0, healAt: 0, seq: 0, respawnAt: 0 }); this.audit('player_spawn', { id }); return p; }
  removeEntity(id:string) {this.entities.delete(id);this.monsterAttack.delete(id);this.threat.delete(id);this.homes.delete(id);}
  removePlayer(id: string) { this.removeEntity(id); this.controls.delete(id);for(const threat of this.threat.values())threat.delete(id); }
  stop(id: string) { const c = this.controls.get(id); if (c) { c.x = 0; c.y = 0; c.goal = undefined; c.path = undefined; } }
  spawnMonster(kind: MonsterKind, x: number, y: number) { const id = `infected_${this.map.id}-${++this.serial}`; const e = this.base(id, kind, x, y, INFECTED[kind].hp); this.entities.set(id, e); this.homes.set(id,{x,y}); return e; }
  isSafe(e:{x:number;y:number}) { return 'safeAreas' in this.map && this.map.safeAreas.some(a=>distance(a,e)<=a.r); }
  intent(id: string, message: Intent): string | undefined {
    const p = this.entities.get(id), c = this.controls.get(id);
    if (!p || !c) return 'session';
    if (message.seq <= c.seq) return 'replay';
    c.seq = message.seq;
    if (message.type === 'respawn') {
      if (p.hp > 0 || this.tick < c.respawnAt) return 'respawn_unavailable';
      p.x = this.map.spawn.x; p.y = this.map.spawn.y; p.hp = p.maxHp; p.stamina = 100; p.animation = 'idle'; this.stop(id); this.audit('respawn', { id }); return;
    }
    if (p.hp <= 0) return 'dead';
    if(message.type==='skill' && message.skill!=='bash') {
      const skill=SKILLS[message.skill],progress=p.progress;
      if(!progress || progress.level<skill.level)return 'locked';
      if(this.tick<(progress.skillReady[message.skill]??0))return 'cooldown';
      if(p.stamina<skill.cost)return 'stamina';
      p.stamina-=skill.cost;progress.skillReady[message.skill]=this.tick+skill.cooldown;
      if(message.skill==='guard')p.guardUntil=this.tick+60;
      else for(const ally of this.entities.values())if(ally.kind==='player'&&ally.hp>0&&(ally.id===id||(progress.party&&ally.progress?.party===progress.party))&&distance(p,ally)<=4)ally.hp=Math.min(ally.maxHp,ally.hp+25);
      this.audit('skill_used',{id,skill:message.skill});return;
    }
    if (message.type === 'navigate') {
      if (c.goal?.x !== message.x || c.goal?.y !== message.y) {
        const path = findPath(p, message,this.map);
        if (!path) { this.stop(id); return 'destination'; }
        c.goal = { x: message.x, y: message.y }; c.path = path;
        this.audit('navigation_start', { id, ...c.goal });
      }
      c.until = this.tick + 6; return;
    }
    if (message.type === 'move') {
      if (!Number.isFinite(message.x) || !Number.isFinite(message.y) || Math.hypot(message.x, message.y) > 1.001) return 'movement';
      c.goal = undefined; c.path = undefined; c.x = message.x; c.y = message.y; c.until = this.tick + 6; return;
    }
    if (message.type === 'equip') { if((p.progress?.level??1)<WEAPONS[message.weapon].level)return 'locked'; if(p.progress&&message.weapon!=='fists'&&!p.progress.gear.some(item=>item.weapon===message.weapon))return 'not_owned';p.weapon = message.weapon; return; }
    if (message.type === 'heal') {
      if (p.bandages < 1 || p.hp === p.maxHp || this.tick < c.healAt) return 'heal_unavailable';
      p.bandages--; p.hp = Math.min(p.maxHp, p.hp + 40); c.healAt = this.tick + 60; this.audit('heal', { id }); return;
    }
    if(!('target' in message))return 'unsupported';
    const target = this.entities.get(message.target ?? '');
    if (!target) return 'target';
    if (message.type === 'attack' || message.type==='skill') {
      const bash=message.type==='skill';
      const w = bash?{...WEAPONS.pipe,damage:15,stamina:SKILLS.bash.cost}:WEAPONS[p.weapon];
      if (!isMonster(target)) return 'invalid_target';
      if(this.isSafe(p)||this.isSafe(target))return 'safe_area';
      if (target.hp <= 0 || distance(p, target) > w.range || !this.lineOfSight(p, target)) return 'range';
      if (this.tick < c.cooldown) return 'cooldown';
      if (p.stamina < w.stamina) return 'stamina';
      if(bash && (!p.progress || this.tick<(p.progress.skillReady.bash??0)))return 'cooldown';
      if(w.ammo>0 && (!p.progress||p.progress.ammo<w.ammo))return 'ammo';
      if(p.progress){p.progress.ammo-=w.ammo;p.progress.mastery++;if(bash)p.progress.skillReady.bash=this.tick+SKILLS.bash.cooldown;}
      if(bash)target.staggerUntil=this.tick+40;
      const damage=w.damage+Math.max(0,(p.progress?.level??1)-1)*2;
      p.stamina -= w.stamina; c.cooldown = this.tick + w.cooldown; p.animation = 'attack'; p.facing = Math.atan2(target.y - p.y, target.x - p.x);
      target.hp = Math.max(0, target.hp - damage); target.animation = target.hp ? 'hurt' : 'dead';
      const threat=this.threat.get(target.id)??new Map<string,number>();threat.set(id,(threat.get(id)??0)+damage);this.threat.set(target.id,threat);
      this.audit('damage', { actor: id, target: target.id, amount: damage, source:bash?'bash':p.weapon });
      if (target.hp === 0) {
        target.expiresTick = this.tick + 20;
        target.aiState='dead';
        if(!target.eventId){const home=this.homes.get(target.id)??target;this.respawns.push({tick:this.tick+300,kind:target.kind,x:home.x,y:home.y});}
        const lootId = `loot_${this.map.id}-${++this.serial}`;
        this.entities.set(lootId, { ...this.base(lootId, 'loot', target.x, target.y, 1), scrap: 3, owner: id, unlockTick: this.tick + 200, expiresTick: this.tick + 1200 });
        this.audit('loot_spawn', { id: lootId, owner: id });
        this.audit('monster_killed',{actor:id,target:target.id,kind:target.kind,eventId:target.eventId});
      }
      return;
    }
    if (distance(p, target) > 1.6 || !this.lineOfSight(p, target)) return 'range';
    if(message.type!=='interact')return 'unsupported';
    if (target.kind === 'loot') {
      const owner=this.entities.get(target.owner??'');
      if (target.owner !== id && !(p.progress?.party && owner?.progress?.party===p.progress.party) && this.tick < (target.unlockTick ?? 0)) return 'ownership';
      p.scrap += target.scrap; this.entities.delete(target.id); this.audit('loot_pickup', { actor: id, loot: target.id, amount: target.scrap }); return;
    }
    if (target.kind === 'container' && target.bandages > 0) { p.bandages++; target.bandages--; this.audit('container_pickup', { actor: id }); return; }
    return 'empty';
  }
  private lineOfSight(a: Entity, b: Entity) { const steps = Math.ceil(distance(a, b) / 0.15); for (let i = 1; i < steps; i++) if (!walkable(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps,this.map)) return false; return true; }
  step(delta = 1) {
    this.tick += delta;
    for (const e of this.entities.values()) {
      if (e.expiresTick && this.tick >= e.expiresTick) { this.removeEntity(e.id); continue; }
      if (e.hp <= 0) continue;
      if (e.kind === 'player') {
        const c = this.controls.get(e.id)!;
        if (this.tick > c.until) this.stop(e.id);
        if (c.path) {
          while (c.path.length && distance(e,c.path[0]) < .001) c.path.shift();
          const next = c.path[0];
          const length = next ? distance(e,next) : 0;
          const divisor = Math.max(length, PLAYER.speed / TICK_RATE * delta);
          c.x = next ? (next.x-e.x)/divisor : 0; c.y = next ? (next.y-e.y)/divisor : 0;
        }
        const active = this.tick <= c.until && (c.x !== 0 || c.y !== 0);
        if (active) { move(e, c.x, c.y, PLAYER.speed*(e.progress && e.progress.injury>0?.85:1),this.map,delta); e.facing = Math.atan2(c.y, c.x); }
        if (this.tick >= c.cooldown - 7) e.animation = active ? 'walk' : 'idle';
        e.stamina = Math.min(100, e.stamina + (e.progress&&(e.progress.hunger<20||e.progress.thirst<20)?.2:.4)*delta);
      } else if (isMonster(e)) {
        if((e.staggerUntil??0)>this.tick){e.aiState='stagger';e.animation='hurt';continue;}
        const prey = [...this.entities.values()].filter(p => p.kind === 'player' && p.hp > 0 && !this.isSafe(p) && distance(p, e) < 7).sort((a, b) => ((this.threat.get(e.id)?.get(b.id)??0)-(this.threat.get(e.id)?.get(a.id)??0))||distance(a, e) - distance(b, e))[0];
        e.animation = 'idle';
        if (!prey) {
          const home=this.homes.get(e.id)!; const far=distance(e,home)>.2;e.aiState=far?'investigate':(this.tick%200<40?'roam':'idle');
          const goal=far?home:{x:home.x+.5,y:home.y};
          if(e.aiState!=='idle'){const path=findPath(e,goal,this.map);const next=path?.find(p=>distance(e,p)>.05);if(next){const d=distance(e,next);move(e,(next.x-e.x)/Math.max(d,INFECTED[e.kind].speed/TICK_RATE*delta),(next.y-e.y)/Math.max(d,INFECTED[e.kind].speed/TICK_RATE*delta),INFECTED[e.kind].speed,this.map,delta);e.animation='walk';}}
          continue;
        }
        const d = distance(e, prey); e.facing = Math.atan2(prey.y - e.y, prey.x - e.x);
        if (d > 0.85) { const path=findPath(e,prey,this.map),next=path?.find(p=>distance(e,p)>.05);if(next){const n=distance(e,next);move(e,(next.x-e.x)/Math.max(n,INFECTED[e.kind].speed/TICK_RATE*delta),(next.y-e.y)/Math.max(n,INFECTED[e.kind].speed/TICK_RATE*delta),INFECTED[e.kind].speed,this.map,delta);}e.aiState='chase'; e.animation = 'walk'; }
        else if (this.tick >= (this.monsterAttack.get(e.id) ?? 0) && this.lineOfSight(e, prey)) {
          this.monsterAttack.set(e.id, this.tick + 24); e.animation = 'attack';e.aiState='attack'; const amount=Math.ceil(INFECTED[e.kind].damage*((prey.guardUntil??0)>this.tick?.3:1));prey.hp = Math.max(0, prey.hp - amount); prey.animation = prey.hp ? 'hurt' : 'dead';
          this.audit('damage',{actor:e.id,target:prey.id,amount,source:e.kind});
          if (!prey.hp) { this.controls.get(prey.id)!.respawnAt = this.tick + 60; this.stop(prey.id); this.audit('player_down', { id: prey.id,source:e.kind }); }
        }
      }
    }
    for (const spawn of this.respawns.filter(s => s.tick <= this.tick)) this.spawnMonster(spawn.kind, spawn.x, spawn.y);
    this.respawns = this.respawns.filter(s => s.tick > this.tick);
  }
}
export function isMonster(e:Entity):e is Entity & {kind:MonsterKind} { return e.kind==='shambler'||e.kind==='runner'||e.kind==='crawler'||e.kind==='elite'; }
