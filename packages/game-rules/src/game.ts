import { World, distance, move, TICK_RATE } from './index.js';
import { clearSegment, findPath } from './navigation.js';
import { MAPS, QUESTS, RECOVERY, EVENT_RULES, type ObjectiveKind } from '../../content-schema/src/world.js';
import { INFECTED } from '../../content-schema/src/index.js';
import type { Entity } from '../../shared-types/src/index.js';
import type { Intent } from '../../protocol/src/index.js';

interface Party { id:string; leader:string; members:Set<string>; invitations:Map<string,number> }
interface EventState { id:string; kind:'horde'|'supply'|'rescue'; map:string; end:number; participants:Map<string,number>; entities:Set<string>; complete:boolean }
export class Game {
  worlds=new Map<string,World>();
  parties=new Map<string,Party>();
  events=new Map<string,EventState>();
  private locations=new Map<string,string>();
  private entered=new Map<string,number>();
  private resourceReady=new Map<string,number>();
  private eventReady=new Map<string,number>();
  private deathCauses=new Map<string,string>();
  private serial=0;
  tick=0;
  constructor(private audit:(event:string,data:object)=>void=()=>{}, private recovery=RECOVERY) {
    for(const map of Object.values(MAPS)) {
      const world=new World((event,data)=>this.onWorldEvent(map.id,event,data),map);this.worlds.set(map.id,world);
      for(const node of map.resources)world.entities.set(`resource_${map.id}-${node.id}`,this.object(`resource_${map.id}-${node.id}`,'resource',map.id,node.x,node.y,node.stock));
      this.eventReady.set(map.id,EVENT_RULES.delayTicks);
    }
  }
  get entities() {return new Map([...this.worlds.values()].flatMap(w=>[...w.entities]));}
  get controls() {return new Map([...this.worlds.values()].flatMap(w=>[...w.controls]));}
  worldFor(id:string) {return this.worlds.get(this.locations.get(id)??'');}
  visible(id:string) {return [...(this.worldFor(id)?.entities.values()??[])];}
  addPlayer(id:string) {
    const p=this.worlds.get('haven')!.addPlayer(id);
    p.progress={level:1,xp:0,bankedScrap:0,hunger:100,thirst:100,injury:0,exposure:0,food:3,water:3,ammo:30,mastery:0,checkpoint:'haven',downUntil:0,dead:false,completed:[],skillReady:{},gear:[{weapon:'pipe',premium:false},{weapon:'hatchet',premium:false},{weapon:'pistol',premium:false}],premiumItems:[],protection:0};
    this.locations.set(id,'haven');this.entered.set(id,this.tick);return p;
  }
  removePlayer(id:string) {this.leaveParty(id);this.worldFor(id)?.removePlayer(id);this.locations.delete(id);this.entered.delete(id);this.deathCauses.delete(id);}
  stop(id:string) {this.worldFor(id)?.stop(id);}
  private object(id:string,kind:Entity['kind'],mapId:string,x:number,y:number,stock=1):Entity {return {id,kind,mapId,x,y,hp:100,maxHp:100,stamina:100,facing:0,animation:'idle',weapon:'pipe',bandages:0,scrap:0,stock};}
  private onWorldEvent(map:string,event:string,data:object) {
    const d=data as {actor?:string;id?:string;target?:string;kind?:keyof typeof INFECTED;eventId?:string;amount?:number;source?:string};
    this.audit(event,{...data,map});
    const world=this.worlds.get(map);
    if(!world)return;
    if(event==='player_down'&&d.id) {const p=world.entities.get(d.id);if(p)this.down(p,d.source??'infected');}
    if(event==='monster_killed'&&d.actor&&d.kind) {
      const p=world.entities.get(d.actor);if(!p)return;
      for(const ally of this.creditGroup(p)) {this.addXP(ally,INFECTED[d.kind].xp);this.credit(ally,'kill',1);}
      if(d.eventId){const ev=this.events.get(map);if(ev?.id===d.eventId){this.contribute(ev,p,1);if([...ev.entities].every(id=>(world.entities.get(id)?.hp??0)<=0))this.finishEvent(ev);}}
    }
    if(event==='damage'&&d.actor&&d.target) {
      const p=world.entities.get(d.actor),target=world.entities.get(d.target);
      if(p?.kind==='player'&&target?.eventId){const ev=this.events.get(map);if(ev?.id===target.eventId)this.contribute(ev,p,d.amount??0);}
      if(target?.progress&&d.source==='elite')target.progress.injury=Math.min(100,target.progress.injury+5);
    }
  }
  private creditGroup(p:Entity) {return this.visible(p.id).filter(e=>e.kind==='player'&&e.hp>0&&(e.id===p.id||(p.progress?.party&&e.progress?.party===p.progress.party))&&distance(e,p)<=8);}
  private addXP(p:Entity,amount:number) {const g=p.progress!;g.xp+=amount;const level=1+Math.floor(g.xp/100);if(level>g.level){g.level=level;p.maxHp=100+(level-1)*5;this.audit('level_up',{id:p.id,level});}}
  private credit(p:Entity,kind:ObjectiveKind,amount:number) {
    const q=p.progress?.quest;if(!q||q.claimed)return;
    QUESTS[q.id].objectives.forEach((o,i)=>{if(o.kind===kind&&o.map===p.mapId)q.counts[i]=Math.min(o.count,q.counts[i]+amount);});
  }
  private down(p:Entity,cause:string) {
    const g=p.progress;if(!g||g.downUntil||g.dead)return;
    p.hp=0;p.animation='dead';g.downUntil=this.tick+RECOVERY.downedTicks;this.deathCauses.set(p.id,cause);this.stop(p.id);this.audit('downed',{id:p.id,cause,reviveUntil:g.downUntil});
  }
  private die(p:Entity) {
    const g=p.progress!;if(g.dead)return;g.dead=true;
    const protectedDeath=g.protection>0;
    const lostScrap=protectedDeath||!this.recovery.loseCarriedItems?0:p.scrap;
    const lostGear=protectedDeath||!this.recovery.loseEquippedGear?[]:g.gear.filter(item=>!item.premium).map(item=>item.weapon);
    if(protectedDeath)g.protection--;
    else {
      if(this.recovery.loseCarriedItems){p.scrap=0;p.bandages=0;g.food=0;g.water=0;g.ammo=0;}
      if(this.recovery.loseEquippedGear){g.gear=g.gear.filter(item=>item.premium);if(!g.gear.some(item=>item.weapon===p.weapon))p.weapon='fists';}
    }
    g.injury=Math.min(100,g.injury+10);
    this.audit('death',{id:p.id,cause:this.deathCauses.get(p.id)??'unknown',lostScrap,lostGear,protectionConsumed:protectedDeath,map:p.mapId});
  }
  private transfer(p:Entity,target:string) {
    const from=this.worldFor(p.id)!,to=this.worlds.get(target)!;
    this.audit('zone_exit',{id:p.id,map:p.mapId,durationSeconds:(this.tick-(this.entered.get(p.id)??this.tick))/TICK_RATE});
    const control=from.controls.get(p.id)!;from.stop(p.id);from.removePlayer(p.id);
    to.entities.set(p.id,p);to.controls.set(p.id,control);p.mapId=target;p.x=to.map.spawn.x;p.y=to.map.spawn.y;
    this.locations.set(p.id,target);this.entered.set(p.id,this.tick);this.credit(p,'visit',1);
    this.audit('map_enter',{id:p.id,map:target});
    if(target==='haven'){p.progress!.bankedScrap+=p.scrap;p.scrap=0;}
  }
  intent(id:string,m:Intent):string|undefined {
    const w=this.worldFor(id),p=w?.entities.get(id),c=w?.controls.get(id);
    if(!w||!p||!c||!p.progress)return 'session';
    const g=p.progress;
    if(m.seq<=c.seq)return 'replay';
    // Intercept gameplay requests once; ordinary combat/movement retains World validation.
    const specialized=['travel','prepare','checkpoint','consume','quest','party','revive','respawn'].includes(m.type) || (m.type==='interact'&&['resource','survivor'].includes(w.entities.get(m.target)?.kind??''));
    if(!specialized) {
      const before=p.scrap;
      const error=w.intent(id,m);
      if(!error&&m.type==='interact'){this.credit(p,'interact',1);if(p.scrap>before)this.credit(p,'collect',p.scrap-before);const ev=this.events.get(p.mapId!);if(ev?.kind==='supply'&&ev.entities.has(m.target)){this.contribute(ev,p,1);this.finishEvent(ev);}}
      return error;
    }
    c.seq=m.seq;
    if(m.type==='respawn') {
      if(p.hp>0||!g.dead)return 'revive_window';
      const destination=MAPS[g.checkpoint]?g.checkpoint:'haven';
      if(this.visibleCount(destination)>=MAPS[destination].maxPlayers&&p.mapId!==destination)return 'map_full';
      this.transfer(p,destination);p.hp=p.maxHp;p.stamina=100;p.animation='idle';g.dead=false;g.downUntil=0;return;
    }
    if(p.hp<=0)return 'dead';
    if(m.type==='travel') {
      const portal=MAPS[p.mapId!].portals.find(v=>v.id===m.portal);
      if(!portal||distance(p,portal)>1.8||!clearSegment(p,portal,w.map))return 'portal_range';
      if(this.visibleCount(portal.target)>=MAPS[portal.target].maxPlayers)return 'map_full';
      this.transfer(p,portal.target);return;
    }
    if(m.type==='prepare') {
      if(p.mapId!=='haven'||distance(p,w.map.spawn)>2)return 'town_only';
      g.hunger=g.thirst=100;g.injury=g.exposure=0;g.food=g.water=3;g.ammo=Math.max(g.ammo,30);p.bandages=Math.max(p.bandages,3);p.hp=p.maxHp;p.stamina=100;
      if(!g.gear.length){g.gear.push({weapon:'pipe',premium:false});p.weapon='pipe';}
      this.audit('prepared',{id});return;
    }
    if(m.type==='checkpoint') {
      if(distance(p,MAPS[p.mapId!].checkpoint)>1.5)return 'checkpoint_range';g.checkpoint=p.mapId!;this.audit('checkpoint',{id,map:p.mapId});return;
    }
    if(m.type==='consume') {
      if(g[m.item]<1)return 'empty';const stat=m.item==='food'?'hunger':'thirst';if(g[stat]>=100)return 'already_full';g[m.item]--;g[stat]=Math.min(100,g[stat]+40);this.audit('consumable_use',{id,item:m.item});return;
    }
    if(m.type==='quest') {
      const q=QUESTS[m.quest];if(!q)return 'quest';
      if(m.action==='abandon'){if(g.quest?.id!==q.id||g.quest.claimed)return 'quest';g.quest=undefined;this.audit('mission_abandoned',{id,quest:q.id});return;}
      if(p.mapId!=='haven'||distance(p,w.map.spawn)>2)return 'town_only';
      if(m.action==='accept'){if(g.completed.includes(q.id)||(g.quest&&!g.quest.claimed))return 'quest_active';g.quest={id:q.id,counts:q.objectives.map(()=>0),claimed:false};this.audit('quest_accepted',{id,quest:q.id});return;}
      if(g.quest?.id!==q.id||g.quest.claimed||q.objectives.some((o,i)=>g.quest!.counts[i]<o.count))return 'quest_incomplete';
      g.quest.claimed=true;g.completed.push(q.id);g.bankedScrap+=q.scrap;this.addXP(p,q.xp);
      g.protection+=q.protection??0;
      if(q.weapon)g.gear.push({weapon:q.weapon,premium:false});
      this.audit('quest_reward',{id,quest:q.id,xp:q.xp,scrap:q.scrap});return;
    }
    if(m.type==='party')return this.partyIntent(p,m);
    if(m.type==='revive') {
      const target=w.entities.get(m.target),tg=target?.progress;
      if(!target||!tg||!g.party||tg.party!==g.party||target.hp>0||tg.dead||!tg.downUntil||distance(p,target)>RECOVERY.reviveRange||!clearSegment(p,target,w.map))return 'revive_unavailable';
      if(p.bandages<1)return 'empty';p.bandages--;target.hp=Math.ceil(target.maxHp*.35);target.animation='idle';tg.downUntil=0;this.audit('revived',{actor:id,target:target.id});return;
    }
    if(m.type==='interact') {
      const target=w.entities.get(m.target);if(!target||distance(p,target)>1.6||!clearSegment(p,target,w.map))return 'range';
      if(target.kind==='resource'){
        if(!target.stock)return 'empty';target.stock--;p.scrap+=2;this.credit(p,'collect',2);this.credit(p,'interact',1);
        if(!target.stock)this.resourceReady.set(target.id,this.tick+2400);
        this.audit('resource_gathered',{id,resource:target.id,amount:2});return;
      }
      const ev=this.events.get(p.mapId!);if(target.kind==='survivor'&&ev?.kind==='rescue'&&ev.entities.has(target.id)){this.contribute(ev,p,1);target.owner=id;return;}
    }
    return 'unsupported';
  }
  private visibleCount(map:string) {return [...this.worlds.get(map)!.entities.values()].filter(e=>e.kind==='player').length;}
  private partyIntent(p:Entity,m:Extract<Intent,{type:'party'}>) {
    const current=this.parties.get(p.progress!.party??'');
    if(m.action==='create') {if(current)return 'already_in_party';const id=`party_${++this.serial}`;this.parties.set(id,{id,leader:p.id,members:new Set([p.id]),invitations:new Map()});p.progress!.party=id;this.audit('party_created',{id,leader:p.id});return;}
    if(m.action==='leave'){this.leaveParty(p.id);return;}
    if(m.action==='invite'){
      const target=this.entities.get(m.target??'');if(!current||current.leader!==p.id||!target?.progress||target.id===p.id||target.progress.party)return 'party_target';
      if(current.members.size>=4)return 'party_full';current.invitations.set(target.id,this.tick+600);this.audit('party_invited',{party:current.id,target:target.id});return;
    }
    const party=this.parties.get(m.target??'');if(current||!party||(party.invitations.get(p.id)??0)<=this.tick)return 'party_invite_required';if(party.members.size>=4)return 'party_full';
    party.invitations.delete(p.id);party.members.add(p.id);p.progress!.party=party.id;this.audit('party_joined',{id:p.id,party:party.id});return;
  }
  private leaveParty(id:string) {
    const p=this.entities.get(id),party=this.parties.get(p?.progress?.party??'');if(!party)return;
    party.members.delete(id);if(p?.progress)p.progress.party=undefined;
    if(!party.members.size)this.parties.delete(party.id);else if(party.leader===id)party.leader=[...party.members][0];
    this.audit('party_left',{id,party:party.id});
  }
  activity(id:string) {
    const p=this.entities.get(id),party=this.parties.get(p?.progress?.party??'');const event=this.events.get(p?.mapId??'');
    return {type:'activity' as const,map:p?.mapId??'haven',event:event?{kind:event.kind,remaining:Math.max(0,Math.ceil((event.end-this.tick)/20)),contributors:event.participants.size}:null,
      party:party?[...party.members].map(id=>{const e=this.entities.get(id)!;return {id,map:e.mapId!,hp:e.hp};}):[],
      invitations:[...this.parties.values()].filter(p=>(p.invitations.get(id)??0)>this.tick).map(p=>p.id)};
  }
  private contribute(ev:EventState,p:Entity,amount:number) {if(ev.complete||p.hp<=0)return;ev.participants.set(p.id,(ev.participants.get(p.id)??0)+amount);}
  private startEvent(map:string) {
    const kind=MAPS[map].events[0];if(!kind)return;
    const ev:EventState={id:`event_${++this.serial}`,kind,map,end:this.tick+EVENT_RULES.durationTicks,participants:new Map(),entities:new Set(),complete:false};
    const w=this.worlds.get(map)!;
    if(kind==='horde')for(const [x,y] of [[7,10],[7,11],[8,10]]){const e=w.spawnMonster('shambler',x,y);e.eventId=ev.id;ev.entities.add(e.id);}
    else {const e=this.object(`${kind==='supply'?'loot':'survivor'}_${ev.id.replace('_','-')}`,kind==='supply'?'loot':'survivor',map,7,10);e.eventId=ev.id;e.scrap=8;w.entities.set(e.id,e);ev.entities.add(e.id);}
    this.events.set(map,ev);this.audit('event_started',{map,kind,id:ev.id});
  }
  private finishEvent(ev:EventState) {
    if(ev.complete)return;ev.complete=true;
    for(const id of ev.participants.keys()){
      const p=this.worlds.get(ev.map)!.entities.get(id);if(!p?.progress||p.hp<=0)continue;
      this.addXP(p,EVENT_RULES.rewardXP);p.progress.bankedScrap+=EVENT_RULES.rewardScrap;
      this.credit(p,ev.kind==='rescue'?'escort':ev.kind==='horde'?'defend':'interact',1);
      this.audit('event_reward',{id,event:ev.id,contribution:ev.participants.get(id)});
    }
    this.audit('event_completed',{id:ev.id,participants:ev.participants.size});
  }
  step(delta = 1) {
    const previousTick=this.tick;this.tick+=delta;
    const secondChanged=Math.floor(previousTick/20)!==Math.floor(this.tick/20);
    for(const w of this.worlds.values())w.step(delta);
    for(const [id,map] of this.locations){
      const w=this.worlds.get(map)!,p=w.entities.get(id)!,g=p.progress!;
      if(p.hp<=0){if(!g.downUntil)this.down(p,'environment');if(this.tick>=g.downUntil)this.die(p);continue;}
      if(!secondChanged)continue;
      if(map!=='haven') {
        g.hunger=Math.max(0,g.hunger-.025);g.thirst=Math.max(0,g.thirst-.04);this.credit(p,'survive',1);
        for(const hazard of MAPS[map].hazards)if(distance(p,hazard)<=hazard.r&&!w.isSafe(p)) {g.exposure=Math.min(100,g.exposure+hazard.exposure);p.hp=Math.max(0,p.hp-hazard.damage);this.audit('damage',{actor:'environment',target:id,amount:hazard.damage,source:'hazard'});}
        if(g.exposure>=80&&!w.isSafe(p))p.hp=Math.max(0,p.hp-1);
        if(p.hp<=0)this.down(p,'environment');
        if(Math.floor(previousTick/1200)!==Math.floor(this.tick/1200))this.audit('survival_depletion',{id,hunger:g.hunger,thirst:g.thirst,exposure:g.exposure});
      }
    }
    for(const [id,ready] of this.resourceReady)if(this.tick>=ready){const e=this.entities.get(id);if(e)e.stock=MAPS[e.mapId!].resources.find(n=>id===`resource_${e.mapId}-${n.id}`)!.stock;this.resourceReady.delete(id);}
    for(const map of Object.keys(MAPS)) {
      const ev=this.events.get(map);
      if(!ev){if(this.tick>=(this.eventReady.get(map)??Infinity)&&this.visibleCount(map)>0)this.startEvent(map);continue;}
      const w=this.worlds.get(map)!;
      if(ev.kind==='rescue'&&!ev.complete){const npc=w.entities.get([...ev.entities][0]);const owner=w.entities.get(npc?.owner??'');
        if(npc&&owner&&owner.hp>0&&distance(npc,owner)<5){this.contribute(ev,owner,.05);const path=findPath(npc,owner,w.map);const next=path?.find(p=>distance(npc,p)>.1);if(next){const d=distance(npc,next);move(npc,(next.x-npc.x)/Math.max(d,.08*delta),(next.y-npc.y)/Math.max(d,.08*delta),1.6,w.map,delta);npc.animation='walk';}if(distance(npc,MAPS[map].checkpoint)<2)this.finishEvent(ev);}}
      if(ev.complete||this.tick>=ev.end){for(const id of ev.entities)w.removeEntity(id);this.events.delete(map);this.eventReady.set(map,this.tick+EVENT_RULES.delayTicks);if(!ev.complete)this.audit('event_failed',{id:ev.id,participants:ev.participants.size});}
    }
    if(secondChanged)for(const party of this.parties.values())for(const [id,until] of party.invitations)if(until<=this.tick)party.invitations.delete(id);
  }
}
