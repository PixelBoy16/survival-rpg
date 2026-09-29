import { MAP } from './index.js';
import type { MonsterKind, Weapon } from '../../shared-types/src/index.js';
export interface MapDefinition {
  id:string; name:string; mapType:'town'|'adventure'|'interior'; recommendedLevel:number; pvpPolicy:'disabled'; maxPlayers:number; environmentTags:string[];
  width:number;height:number;spawn:{x:number;y:number};walls:{x:number;y:number;w:number;h:number}[];
  safeAreas:{x:number;y:number;r:number}[];
  spawns:{kind:MonsterKind;x:number;y:number}[];
  resources:{id:string;x:number;y:number;stock:number}[];
  events:('horde'|'supply'|'rescue')[];
  portals:{id:string;target:string;x:number;y:number}[];
  hazards:{x:number;y:number;r:number;damage:number;exposure:number}[];
  checkpoint:{x:number;y:number};color:number;
}
const common={width:24,height:24,spawn:{x:5,y:5},pvpPolicy:'disabled' as const,checkpoint:{x:5,y:5}};
export const MAPS:Record<string,MapDefinition>={
  haven:{...common,id:'haven',name:'Haven Town',mapType:'town',recommendedLevel:1,maxPlayers:100,environmentTags:['safe','settlement'],walls:[{x:12,y:12,w:4,h:3}],safeAreas:[{x:12,y:12,r:40}],spawns:[],resources:[],events:[],portals:[{id:'forest',target:'forest',x:8,y:5},{id:'road',target:'road',x:5,y:8}],hazards:[],color:0x4c5740},
  forest:{...common,id:'forest',name:'Forest',mapType:'adventure',recommendedLevel:1,maxPlayers:50,environmentTags:['woodland','foraging'],walls:MAP.walls,safeAreas:[{x:5,y:5,r:2}],spawns:[{kind:'shambler',x:7,y:12},{kind:'runner',x:12,y:10}],resources:[{id:'wood',x:7,y:7,stock:5}],events:['horde'],portals:[{id:'haven',target:'haven',x:4,y:4},{id:'road',target:'road',x:20,y:20}],hazards:[{x:16,y:18,r:2,damage:1,exposure:1}],color:0x304631},
  road:{...common,id:'road',name:'Abandoned Road',mapType:'adventure',recommendedLevel:2,maxPlayers:50,environmentTags:['ruins','exposed'],walls:[{x:10,y:4,w:2,h:8},{x:15,y:16,w:5,h:2}],safeAreas:[{x:5,y:5,r:2}],spawns:[{kind:'runner',x:12,y:13},{kind:'crawler',x:17,y:9}],resources:[{id:'metal',x:7,y:8,stock:5}],events:['supply'],portals:[{id:'haven',target:'haven',x:4,y:4},{id:'hospital',target:'hospital',x:20,y:20},{id:'forest',target:'forest',x:4,y:20}],hazards:[{x:14,y:12,r:2,damage:2,exposure:0}],color:0x4c4940},
  hospital:{...common,id:'hospital',name:'Hospital Interior',mapType:'interior',recommendedLevel:2,maxPlayers:8,environmentTags:['interior','infection'],walls:[{x:10,y:3,w:1,h:12},{x:15,y:8,w:6,h:1}],safeAreas:[{x:5,y:5,r:2}],spawns:[{kind:'crawler',x:7,y:14},{kind:'elite',x:16,y:16}],resources:[{id:'medicine',x:7,y:10,stock:4}],events:['rescue'],portals:[{id:'road',target:'road',x:4,y:4}],hazards:[{x:16,y:12,r:2,damage:1,exposure:2}],color:0x414f4c}
};
export type ObjectiveKind='kill'|'collect'|'interact'|'escort'|'visit'|'survive'|'defend';
export interface QuestDefinition {id:string;name:string;objectives:{kind:ObjectiveKind;map:string;count:number}[];xp:number;scrap:number;weapon?:Weapon;protection?:number}
export const QUESTS:Record<string,QuestDefinition>={
  supplies:{id:'supplies',name:'Beyond the perimeter',objectives:[{kind:'visit',map:'forest',count:1},{kind:'kill',map:'forest',count:2},{kind:'collect',map:'forest',count:3}],xp:100,scrap:10,weapon:'rifle',protection:1},
  relief:{id:'relief',name:'Road relief',objectives:[{kind:'visit',map:'road',count:1},{kind:'interact',map:'road',count:1},{kind:'survive',map:'road',count:60}],xp:120,scrap:15,weapon:'shotgun'},
  rescue:{id:'rescue',name:'Bring them home',objectives:[{kind:'visit',map:'hospital',count:1},{kind:'escort',map:'hospital',count:1},{kind:'defend',map:'forest',count:1}],xp:160,scrap:20}
};
// Owner-approved: lose all carried items and gear, except premium items or one-use protection.
export const RECOVERY={loseCarriedItems:true,loseEquippedGear:true,downedTicks:400,reviveRange:1.6};
export const EVENT_RULES={delayTicks:1200,durationTicks:1800,rewardXP:50,rewardScrap:5};
