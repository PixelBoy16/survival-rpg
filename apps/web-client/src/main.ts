import 'pixi.js/unsafe-eval'; // The playtest gateway CSP forbids eval; this Pixi build avoids new Function().
import { Application, Container, Graphics, Sprite, Texture, Text } from 'pixi.js';
import { WEAPONS, SKILLS } from '../../../packages/content-schema/src/index.js';
import { MAPS, QUESTS } from '../../../packages/content-schema/src/world.js';
import type { Weapon } from '../../../packages/shared-types/src/index.js';
import { VERSION, type Intent, type ServerMessage } from '../../../packages/protocol/src/index.js';
import type { Entity, Animation } from '../../../packages/shared-types/src/index.js';
import './style.css';
import { Joystick, screenDirection, screenToWorld, type MovementMode } from './controls.js';

const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const touchDevice = matchMedia('(pointer: coarse)');
let mobile = touchDevice.matches;
let movementMode: MovementMode = 'keyboard';
try { if(localStorage.getItem('haven-movement') === 'click') movementMode='click'; } catch { /* Storage may be disabled. */ }
const joystick = new Joystick();
let destination: {x:number;y:number} | undefined;
const app = new Application();
try { await app.init({ resizeTo: window, background: '#111b18', antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true, preference: 'webgl' }); } catch { element('notice').textContent = 'WebGL could not start. Enable hardware acceleration and reload.'; throw Error('Renderer unavailable'); }
element('game').append(app.canvas);
const scene = new Container(), terrain = new Container(), actors = new Container(), debugLayer = new Graphics();
scene.addChild(terrain, actors, debugLayer); actors.sortableChildren = true; app.stage.addChild(scene);
const destinationMarker = new Graphics().ellipse(0,0,12,6).stroke({color:0xe0c57e,width:2});
terrain.addChild(destinationMarker); destinationMarker.visible=false;
const iso = (x: number, y: number) => ({ x: (x - y) * 32, y: (x + y) * 16 });
const tile = new Graphics().poly([0, -16, 32, 0, 0, 16, -32, 0]).fill(0xffffff).stroke({ color: 0x18251e, width: 0.5 });
const tileTexture = app.renderer.generateTexture(tile); tile.destroy();
let MAP=MAPS.haven;
const wallViews:Graphics[]=[];
function renderMap(id:string) {
  MAP=MAPS[id]??MAPS.haven;
  terrain.removeChild(destinationMarker);
  for(const child of terrain.removeChildren())child.destroy();
  for(const wall of wallViews)wall.destroy();wallViews.length=0;
for (let y = 0; y < MAP.height; y++) for (let x = 0; x < MAP.width; x++) {
  const sprite = new Sprite(tileTexture); sprite.anchor.set(0.5); sprite.position.copyFrom(iso(x + 0.5, y + 0.5));
  sprite.tint = MAP.color+((x+y)%3)*0x020202; terrain.addChild(sprite);
}
for (const w of MAP.walls) for (let x = w.x; x < w.x + w.w; x++) for (let y = w.y; y < w.y + w.h; y++) {
  const p = iso(x + 0.5, y + 0.5), g = new Graphics();
  g.poly([0,-43,32,-27,0,-11,-32,-27]).fill(0x6a7059).poly([-32,-27,0,-11,0,16,-32,0]).fill(0x424c3d).poly([0,-11,32,-27,32,0,0,16]).fill(0x303c31);
  g.position.copyFrom(p); g.zIndex = x + y + 0.9; actors.addChild(g);wallViews.push(g);
}
for(const hazard of MAP.hazards){const p=iso(hazard.x,hazard.y);terrain.addChild(new Graphics().ellipse(p.x,p.y,hazard.r*40,hazard.r*20).fill({color:0x9f7147,alpha:.4}));}
for(const portal of MAP.portals){const p=iso(portal.x,portal.y);terrain.addChild(new Graphics().ellipse(p.x,p.y,22,11).stroke({color:0xbbd3e8,width:2}));const label=new Text({text:`→ ${MAPS[portal.target].name}`,style:{fontSize:11,fill:0xd2dfdf}});label.position.set(p.x-25,p.y-25);terrain.addChild(label);}
const arrival = new Text({ text: `${MAP.name.toUpperCase()} / CHECKPOINT`, style: { fontFamily: 'monospace', fontSize: 11, fill: 0x9eac7c, letterSpacing: 2 } }); arrival.position.copyFrom(iso(3, 3)); terrain.addChild(arrival, destinationMarker);
element('map-name').textContent=MAP.name;
}
renderMap('haven');
// Procedural placeholder sprite frames share GPU textures. Replace with authored atlases later.
const frames = new Map<string, Texture[]>();
for (const kind of ['player', 'runner', 'shambler','crawler','elite', 'loot', 'container','resource','survivor']) for (const state of ['idle','walk','attack','hurt','dead'] satisfies Animation[]) {
  const textures: Texture[] = [];
  for (let frame = 0; frame < 4; frame++) {
    const g = new Graphics(); const color = kind === 'player' ? 0xbbc89a : kind === 'runner' ? 0xb58163 : 0x819467;
    g.rect(0, 0, 64, 72).fill({ color: 0, alpha: 0 }); g.ellipse(32, 61, 15, 6).fill({ color: 0x000000, alpha: .25 });
    if (kind === 'container'||kind==='resource') g.rect(15, 37, 34, 22).fill(kind==='resource'?0x779c68:0x8e9565).rect(15, 35, 34, 6).fill(0xc1bc80).rect(29, 39, 6, 12).fill(0x394538);
    else if (kind === 'loot') g.poly([32,41,42,50,32,59,22,50]).fill(0xe0c57e).stroke({ color: 0xeadcb0, width: 1 });
    else if (state === 'dead') g.ellipse(32, 56, 18, 7).fill(0x675c4c);
    else {
      const bob = state === 'walk' ? frame % 2 * 2 : 0, stride = state === 'walk' ? (frame % 2 ? 4 : -4) : 0;
      g.rect(23, 47, 7, 14 + stride).fill(0x37423a).rect(34, 47, 7, 14 - stride).fill(0x37423a);
      g.roundRect(21, 27 - bob, 23, 24, 5).fill(state === 'hurt' ? 0xe3b999 : color);
      g.circle(32, 19 - bob, 10).fill(kind === 'player' ? 0xcbb598 : 0xa8ac81).rect(23, 10 - bob, 18, 7).fill(0x414b38);
      const reach = state === 'attack' ? frame * 4 : 0;
      g.moveTo(44, 35 - bob).lineTo(50 + reach, 46 - reach).stroke({ color: 0xd5c7a0, width: 5 });
      if (kind === 'player') g.moveTo(49 + reach, 45 - reach).lineTo(56 + reach, 23 - reach).stroke({ color: 0xadb5ad, width: 4 });
    }
    textures.push(app.renderer.generateTexture(g)); g.destroy();
  }
  frames.set(`${kind}:${state}`, textures);
}
interface View { sprite: Sprite; label: Text; ring: Graphics; x: number; y: number }
const entities = new Map<string, Entity>(), views = new Map<string, View>(), pool: View[] = [];
let playerId = '', selected = '', seq = 0, socket: WebSocket, generation = 0, ready = false, latency = 0, debug = false, zoom = 1.3, tick = 0, rtt = 0, bytes = 0, bytesPerSecond = 0, lastTraffic = performance.now(), retry = 0, lastMessage = performance.now();
let token = sessionStorage.getItem('haven-session') ?? undefined;
let activity:Extract<ServerMessage,{type:'activity'}>|undefined;
const notice = (text: string) => { element('notice').textContent = text; window.setTimeout(() => { if (element('notice').textContent === text) element('notice').textContent = ''; }, 2600); };
function rawSend(message: object) { const target = socket; const gen = generation; setTimeout(() => { if (gen === generation && target.readyState === WebSocket.OPEN) { const data = JSON.stringify(message); bytes += data.length; target.send(data); } }, latency); }
type Action = Intent extends infer I ? I extends Intent ? Omit<I, 'seq'> : never : never;
function send(message: Action) { if (ready) rawSend({ ...message, seq: ++seq }); }
function connect() {
  const gen = ++generation; ready = false;
  element('connection').textContent = 'Connecting…'; element('light').style.background = '#d8a071';
  socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/socket`);
  socket.onopen = () => rawSend({ type: 'hello', version: VERSION, ...(token ? { token } : {}) });
  socket.onmessage = event => { bytes += event.data.length; lastMessage = performance.now(); setTimeout(() => {
    if (gen !== generation) return;
    const msg = JSON.parse(event.data) as ServerMessage;
    if (msg.type === 'welcome') { ready = true; retry = 0; token = msg.token; sessionStorage.setItem('haven-session', token); playerId = msg.playerId; seq = msg.seq; tick = msg.tick; entities.clear(); for (const e of msg.entities) entities.set(e.id, e); element('connection').textContent = 'Connected'; element('light').style.background = '#c5d78b'; }
    if (msg.type === 'delta') { tick = msg.tick; for (const e of msg.upsert) entities.set(e.id, e); for (const id of msg.remove) entities.delete(id); }
    if(msg.type==='activity')activity=msg;
    if (msg.type === 'reject' && msg.reason === 'destination') { destination=undefined; notice('Choose open ground inside the yard.'); return; }
    if (msg.type === 'pong') rtt = Math.round(performance.now() - msg.sent);
    if (msg.type === 'reject') { if (msg.reason === 'session_expired') { token = undefined; sessionStorage.removeItem('haven-session'); } notice(({ range: 'Move closer with a clear path.', cooldown: 'Weapon recovering…', ownership: 'Salvage reserved for another survivor.', dead: 'You are down. Ask your party for a revive or wait for the recovery countdown.', empty: 'Supply cache is empty.', heal_unavailable: 'Bandage unavailable or health already full.' } as Record<string, string>)[msg.reason] ?? `Request rejected: ${msg.reason}`); }
  }, latency); };
  socket.onclose = event => { if (gen !== generation) return; ready = false; resetMovement(); element('connection').textContent = 'Disconnected / retrying'; if (event.reason === 'Session replaced') { notice('This session opened in another tab. Reload to join separately.'); token = undefined; sessionStorage.removeItem('haven-session'); return; } setTimeout(connect, Math.min(5000, 500 * 2 ** retry++)); };
  socket.onerror = () => { element('connection').textContent = 'Server unavailable / retrying'; };
}
const keys = new Set<string>();
function resetMovement() {
  keys.clear(); destination=undefined; joystick.reset();
  element('joystick-knob').style.transform='translate(0px,0px)';
  send({type:'move',x:0,y:0});
}
function updateControlLayout() {
  document.body.classList.toggle('mobile-controls',mobile);
  element('respawn').textContent=mobile?'Return to arrival':'Return to arrival · R';
  element<HTMLSelectElement>('movement-mode').value=movementMode;
  element('control-help').textContent=mobile ? 'Drag joystick to move · Tap a target · Use action buttons' : movementMode==='click' ? 'CLICK GROUND to walk · CLICK ENTITY to select · SPACE to attack · ESC to stop' : 'WASD / ARROWS to move · CLICK to select · SPACE to attack · SCROLL to zoom';
}
touchDevice.addEventListener('change',event=>{resetMovement();mobile=event.matches;updateControlLayout();});
element<HTMLSelectElement>('movement-mode').onchange=event=>{
  resetMovement();movementMode=(event.target as HTMLSelectElement).value==='click'?'click':'keyboard';
  try {localStorage.setItem('haven-movement',movementMode);} catch { /* Use this session's preference. */ }
  updateControlLayout();
};
app.stage.eventMode='static'; app.stage.hitArea=app.screen;
app.stage.on('pointerdown',event=>{
  if(mobile || movementMode!=='click' || event.button!==0 || !ready)return;
  const p=entities.get(playerId);if(!p || p.hp<=0)return;
  destination=screenToWorld(event.global.x,event.global.y,scene.x,scene.y,scene.scale.x);
  send({type:'navigate',...destination});
});
const stick=element('joystick');
function updateJoystick(event: PointerEvent) {
  const bounds=stick.getBoundingClientRect();
  joystick.update(event.pointerId,event.clientX-bounds.left-bounds.width/2,event.clientY-bounds.top-bounds.height/2,42);
  element('joystick-knob').style.transform=`translate(${joystick.x*42}px,${joystick.y*42}px)`;
}
stick.addEventListener('pointerdown',event=>{
  if(!mobile || !joystick.start(event.pointerId))return;
  event.preventDefault();stick.setPointerCapture(event.pointerId);updateJoystick(event);
});
stick.addEventListener('pointermove',updateJoystick);
for(const name of ['pointerup','pointercancel','lostpointercapture']) stick.addEventListener(name,event=>{
  const id=(event as PointerEvent).pointerId;if(id!==joystick.pointer)return;
  joystick.release(id);element('joystick-knob').style.transform='translate(0px,0px)';send({type:'move',x:0,y:0});
});
window.addEventListener('resize',()=>{resetMovement();app.stage.hitArea=app.screen;});
window.addEventListener('keydown',event=>{if(!mobile && event.code==='Escape')resetMovement();});
updateControlLayout();
function attack() { let target = entities.get(selected); const p = entities.get(playerId); if (!p) return; if (!target || !['runner', 'shambler','crawler','elite'].includes(target.kind)) target = [...entities.values()].filter(e => ['runner', 'shambler','crawler','elite'].includes(e.kind) && e.hp > 0).sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]; if (target) { selected = target.id; send({ type: 'attack', target: target.id }); } }
function interact() { const p = entities.get(playerId); if (!p) return; const chosen=entities.get(selected); if(chosen && ['loot','container','resource','survivor'].includes(chosen.kind)){send({type:'interact',target:chosen.id});return;} const target = [...entities.values()].filter(e => e.kind === 'loot' || e.kind === 'container'||e.kind==='resource'||e.kind==='survivor').sort((a,b) => Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]; if (target) { selected = target.id; send({ type: 'interact', target: target.id }); } }
window.addEventListener('keydown', e => { if (mobile || (e.target as HTMLElement).matches('select,input')) return; if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','F3'].includes(e.code)) e.preventDefault(); keys.add(e.code); if (e.repeat) return; if (e.code === 'Space') attack(); if (e.code === 'KeyE') interact(); if (e.code === 'Digit1') send({ type: 'equip', weapon: 'pipe' }); if (e.code === 'Digit2') send({ type: 'equip', weapon: 'hatchet' }); if (e.code === 'Digit3') send({ type: 'heal' }); if (e.code === 'KeyR') send({ type: 'respawn' }); if (e.code === 'F3') debug = !debug; });
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', resetMovement);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetMovement(); });
app.canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(.7, Math.min(2, zoom - e.deltaY * .001)); }, { passive: false });
element('debug').onclick = () => { debug = !debug; };
element<HTMLSelectElement>('latency').onchange = e => { latency = Number((e.target as HTMLSelectElement).value); };
element('reconnect').onclick = () => socket.close();
element('attack').onclick=attack;
const weaponSelect=element<HTMLSelectElement>('weapon-select');
for(const [id,weapon] of Object.entries(WEAPONS)){const option=document.createElement('option');option.value=id;option.textContent=`${weapon.name} · Lv ${weapon.level}`;weaponSelect.append(option);}
weaponSelect.onchange=()=>send({type:'equip',weapon:weaponSelect.value as Weapon});
element('prepare').onclick=()=>send({type:'prepare'});
element('checkpoint').onclick=()=>send({type:'checkpoint'});
element('food').onclick=()=>send({type:'consume',item:'food'});
element('water').onclick=()=>send({type:'consume',item:'water'});
element('travel').onclick=()=>{const p=entities.get(playerId);if(!p)return;const portal=[...MAP.portals].sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];if(portal){resetMovement();send({type:'travel',portal:portal.id});}};
function useSkill(skill:keyof typeof SKILLS){send({type:'skill',skill,...(selected?{target:selected}:{})});}
for(const skill of ['bash','guard','rally'] as const)element(skill).onclick=()=>useSkill(skill);
window.addEventListener('keydown',event=>{if(mobile||event.repeat||(event.target as HTMLElement).matches('input,select,button'))return;const skill=({KeyQ:'bash',KeyF:'guard',KeyG:'rally'} as const)[event.code as 'KeyQ'];if(skill)useSkill(skill);});
element('revive').onclick=()=>{if(selected)send({type:'revive',target:selected});};
for(const action of ['accept','claim','abandon'] as const)element(`quest-${action}`).onclick=()=>send({type:'quest',action,quest:action==='accept'?element<HTMLSelectElement>('quest-select').value:entities.get(playerId)?.progress?.quest?.id??element<HTMLSelectElement>('quest-select').value});
element('party-create').onclick=()=>send({type:'party',action:'create'});
element('party-leave').onclick=()=>send({type:'party',action:'leave'});
element('party-invite').onclick=()=>{if(selected)send({type:'party',action:'invite',target:selected});};
element('party-join').onclick=()=>{const invitation=activity?.invitations[0];if(invitation)send({type:'party',action:'join',target:invitation});else notice('No invitation available.');};
element('zoom-in').onclick=()=>{zoom=Math.min(2,zoom+.15);};
element('zoom-out').onclick=()=>{zoom=Math.max(.7,zoom-.15);};
element('pipe').onclick = () => send({ type: 'equip', weapon: 'pipe' }); element('hatchet').onclick = () => send({ type: 'equip', weapon: 'hatchet' }); element('heal').onclick = () => send({ type: 'heal' }); element('interact').onclick = interact; element('respawn').onclick = () => send({ type: 'respawn' });
setInterval(() => {
  if (!ready) return;
  const p=entities.get(playerId);
  if(!p || p.hp<=0){destination=undefined;joystick.reset();element('joystick-knob').style.transform='translate(0px,0px)';return;}
  if(!mobile && movementMode==='click') {
    if(destination && Math.hypot(destination.x-p.x,destination.y-p.y)>.02)send({type:'navigate',...destination});
    else {destination=undefined;send({type:'move',x:0,y:0});}
    return;
  }
  const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const down = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  const direction=mobile?screenDirection(joystick.x,joystick.y):screenDirection(right,down);
  send({ type: 'move', ...direction });
}, 50);
setInterval(() => { if (ready) { if (performance.now() - lastMessage > 8000) socket.close(); else rawSend({ type: 'ping', sent: performance.now() }); } }, 1000);
let framesCount = 0, frameTotal = 0, rendered = 0;
app.ticker.add(ticker => {
  const now = performance.now(), smooth = 1 - Math.exp(-ticker.deltaMS / 55); rendered = 0;
  for (const [id, view] of views) if (!entities.has(id)) { view.sprite.visible = view.label.visible = view.ring.visible = false; pool.push(view); views.delete(id); }
  const p = entities.get(playerId);
  if(p?.mapId&&MAP.id!==p.mapId){resetMovement();selected='';renderMap(p.mapId);for(const [id,v] of views){const e=entities.get(id);if(e){v.x=e.x;v.y=e.y;}}const pos=iso(p.x,p.y);scene.position.set(innerWidth*.55-pos.x*zoom,innerHeight*.47-pos.y*zoom);}
  destinationMarker.visible=!!destination;
  if(destination)destinationMarker.position.copyFrom(iso(destination.x,destination.y));
  if (p) {
    const pos = iso(p.x, p.y); scene.scale.set(zoom); scene.x += (innerWidth * .55 - pos.x * zoom - scene.x) * smooth; scene.y += (innerHeight * .47 - pos.y * zoom - scene.y) * smooth;
    element<HTMLProgressElement>('hp').value = p.hp; element<HTMLProgressElement>('stamina').value = p.stamina;
    element('hpText').textContent = `${p.hp} / ${p.maxHp}`; element('staminaText').textContent = `${Math.round(p.stamina)}`;
    element('inventory').textContent = `${p.bandages} bandages · ${p.scrap} scrap`;
    element('pipe').classList.toggle('active', p.weapon === 'pipe'); element('hatchet').classList.toggle('active', p.weapon === 'hatchet'); element('respawn').hidden = p.hp > 0;
    const g=p.progress;
    if(g){
      element<HTMLProgressElement>('hp').max=p.maxHp;
      element('progression').textContent=`Level ${g.level} · XP ${g.xp} · bank ${g.bankedScrap} · field scrap ${p.scrap} · ammo ${g.ammo}`;
      element('survival').textContent=`Food ${Math.ceil(g.hunger)}% (${g.food}) · Water ${Math.ceil(g.thirst)}% (${g.water}) · Injury ${g.injury} · Exposure ${g.exposure}`;
      element('recovery').textContent=g.protection>0?`Death protection: ${g.protection} charge(s). One is consumed on full death; other items survive.`:'Full death loses carried inventory and equipped gear. Premium items, banked storage, level and XP remain safe. Party revive prevents loss.';
      const q=g.quest,definition=q?QUESTS[q.id]:undefined;
      element('mission').textContent=definition&&q?`${definition.name}: ${definition.objectives.map((o,i)=>`${o.kind} ${q.counts[i]}/${o.count}`).join(' · ')}${q.claimed?' · Claimed':''}`:'Accept a mission and prepare near the Haven checkpoint.';
      element('event-state').textContent=activity?.event?`Event: ${activity.event.kind} · ${activity.event.remaining}s · ${activity.event.contributors} contributors`:'Public events begin after a minute in adventure maps.';
      element('party-state').textContent=activity?.party.length?`Party ${activity.party.length}/4: ${activity.party.map(e=>`${e.id===playerId?'You':e.id.slice(-4)} ${e.hp} HP (${e.map})`).join(' · ')}`:activity?.invitations.length?'Party invitation available — Accept invitation':'Solo · select a survivor to invite after creating a party';
      weaponSelect.value=p.weapon;
      for(const option of Array.from(weaponSelect.options))option.disabled=(g.level<WEAPONS[option.value as Weapon].level)||(option.value!=='fists'&&!g.gear.some(item=>item.weapon===option.value));
      for(const [id,skill] of Object.entries(SKILLS)){const button=element<HTMLButtonElement>(id);const remaining=Math.max(0,Math.ceil(((g.skillReady[id]??0)-tick)/20));button.textContent=`${skill.name}${remaining?` · ${remaining}s`:g.level<skill.level?` · Lv ${skill.level}`:''}`;button.disabled=remaining>0||g.level<skill.level||p.hp<=0;}
      element('respawn').textContent=g.dead?'Return to checkpoint':`Downed · revive window ${Math.max(0,Math.ceil((g.downUntil-tick)/20))}s`;
      element<HTMLButtonElement>('respawn').disabled=!g.dead;
    }
  }
  for (const e of entities.values()) {
    let v = views.get(e.id);
    if (!v) {
      v = pool.pop();
      if (!v) { const sprite = new Sprite(), label = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 9, fill: 0xdde6c5, align: 'center' } }), ring = new Graphics().ellipse(0,0,18,9).stroke({ color: 0xd3e89a, width: 1.5 }); sprite.anchor.set(.5, .86); label.anchor.set(.5,1); sprite.eventMode = 'static'; sprite.cursor = 'crosshair'; sprite.on('pointerdown', event => { event.stopPropagation(); selected = sprite.label; }); actors.addChild(ring, sprite, label); v = { sprite, label, ring, x:e.x, y:e.y }; }
      v.x=e.x; v.y=e.y; v.sprite.label = e.id; views.set(e.id, v);
    }
    v.x += (e.x - v.x) * smooth; v.y += (e.y - v.y) * smooth;
    const pos = iso(v.x, v.y), sx = scene.x + pos.x * zoom, sy = scene.y + pos.y * zoom;
    const visible = sx > -80 && sx < innerWidth + 80 && sy > -80 && sy < innerHeight + 80;
    v.sprite.visible = visible; v.label.visible = visible; v.ring.visible = visible && (selected === e.id || playerId === e.id);
    if (!visible) continue; rendered++;
    v.sprite.texture = frames.get(`${e.kind}:${e.animation}`)![Math.floor(now / (e.animation === 'attack' ? 65 : 140)) % 4];
    v.sprite.scale.x = Math.cos(e.facing) >= 0 ? 1 : -1; v.sprite.position.copyFrom(pos); v.sprite.zIndex = v.x + v.y + .1;
    v.label.position.set(pos.x, pos.y - 49); v.label.zIndex = v.x + v.y + .2;
    v.label.text = e.kind === 'player' ? `${e.id === playerId ? 'YOU' : 'SURVIVOR'} · ${e.hp}` : e.kind === 'loot' ? (mobile ? 'SALVAGE' : 'SALVAGE · E') : e.kind === 'container' ? `SUPPLIES · ${e.bandages}` : `${e.kind.toUpperCase()} · ${e.hp}`;
    if(e.kind==='resource')v.label.text=`GATHER · ${e.stock??0}`;
    if(e.kind==='survivor')v.label.text='RESCUE · Collect to escort';
    if(e.kind==='shambler')v.label.text=`WALKER · ${e.hp}`;
    if((e.partyId??e.progress?.party)&&(e.partyId??e.progress?.party)===p?.progress?.party)v.label.text=`◆ ${v.label.text}`;
    if (debug) v.label.text += `\n${e.id.slice(0,16)} ${e.x.toFixed(1)},${e.y.toFixed(1)}`;
    v.ring.position.copyFrom(pos); v.ring.zIndex = v.x + v.y - .1;
  }
  const target = entities.get(selected);
  element('target').textContent = target ? `${target.kind.toUpperCase()}  /  ${['loot','container','resource','survivor'].includes(target.kind) ? (mobile ? 'Collect nearby' : 'E to collect nearby') : `${target.hp} HP · ${mobile ? 'Tap Attack' : 'Space to attack'}`}` : `Select a target · ${p ? WEAPONS[p.weapon].name : 'Joining…'}`;
  debugLayer.clear(); debugLayer.visible = debug;
  if (debug) { for (const w of MAP.walls) { const corners = [iso(w.x,w.y),iso(w.x+w.w,w.y),iso(w.x+w.w,w.y+w.h),iso(w.x,w.y+w.h)]; debugLayer.poly(corners.flatMap(c => [c.x,c.y])).stroke({ color: 0xf3b788, width: 2 }); } }
  framesCount++; frameTotal += ticker.elapsedMS;
  if (now - lastTraffic >= 1000) { bytesPerSecond = Math.round(bytes * 1000 / (now - lastTraffic)); bytes = 0; lastTraffic = now; element('metrics').textContent = `${Math.round(1000 * framesCount / frameTotal)} FPS · ${(frameTotal/framesCount).toFixed(1)} ms · ${rtt} ms RTT · ${rendered} entities · ${(bytesPerSecond/1024).toFixed(1)} KB/s${debug ? ` · tick ${tick}` : ''}`; framesCount=0; frameTotal=0; }
});
connect();
