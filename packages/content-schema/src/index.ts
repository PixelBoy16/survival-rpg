// Content v1: all tuning is consumed by the server; client copies are descriptive only.
export const CONTENT_VERSION = 2;
export const MAP = { id: 'quarantine-yard', width: 24, height: 24, spawn: { x: 5, y: 5 }, walls: [ { x: 9, y: 5, w: 1, h: 7 }, { x: 14, y: 13, w: 6, h: 1 }, { x: 3, y: 16, w: 4, h: 2 }, { x: 17, y: 4, w: 3, h: 3 } ] };
export const PLAYER = { hp: 100, speed: 3.6, radius: 0.28, stamina: 100 };
export const WEAPONS = {
  fists: {name:'Unarmed',damage:8,range:1,cooldown:12,stamina:5,level:1,ammo:0},
  pipe: { name: 'Steel pipe', damage: 25, range: 1.65, cooldown: 12, stamina: 12, level:1, ammo:0 },
  hatchet: { name: 'Field hatchet', damage: 38, range: 1.25, cooldown: 18, stamina: 18, level:1, ammo:0 },
  pistol: { name: 'Pistol', damage: 24, range: 6, cooldown: 10, stamina: 6, level:1, ammo:1 },
  rifle: { name: 'Rifle', damage: 40, range: 8, cooldown: 16, stamina: 8, level:2, ammo:1 },
  shotgun: { name: 'Shotgun', damage: 55, range: 3.5, cooldown: 24, stamina: 12, level:2, ammo:2 }
};
export const INFECTED = { shambler: { hp: 75, speed: 1.25, damage: 9, xp:20 }, runner: { hp: 50, speed: 2.3, damage: 6, xp:20 }, crawler:{hp:60,speed:.9,damage:12,xp:25}, elite:{hp:200,speed:1.4,damage:18,xp:60} };
export const SKILLS = { bash:{name:'Bash',cost:20,cooldown:100,level:1}, guard:{name:'Guard',cost:15,cooldown:160,level:1}, rally:{name:'Rally',cost:30,cooldown:240,level:2} };
