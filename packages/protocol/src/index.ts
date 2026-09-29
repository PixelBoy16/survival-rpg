import { z } from 'zod';
import type { Entity } from '../../shared-types/src/index.js';
export const VERSION = 2;
const seq = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const id = z.string().regex(/^[a-z]+_[a-zA-Z0-9-]{1,64}$/);
export const ClientMessage = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('hello'), version: z.literal(VERSION), token: z.string().uuid().optional() }),
  z.strictObject({ type: z.literal('move'), seq, x: z.number().finite().min(-1).max(1), y: z.number().finite().min(-1).max(1) }).refine(v => Math.hypot(v.x, v.y) <= 1.001, 'Movement must be normalized'),
  z.strictObject({ type: z.literal('attack'), seq, target: id }),
  z.strictObject({ type: z.literal('navigate'), seq, x: z.number().finite().min(0).max(24), y: z.number().finite().min(0).max(24) }),
  z.strictObject({ type: z.literal('interact'), seq, target: id }),
  z.strictObject({ type: z.literal('equip'), seq, weapon: z.enum(['fists','pipe', 'hatchet','pistol','rifle','shotgun']) }),
  z.strictObject({ type:z.literal('skill'),seq,skill:z.enum(['bash','guard','rally']),target:id.optional() }),
  z.strictObject({ type:z.literal('travel'),seq,portal:z.string().min(1).max(32) }),
  z.strictObject({ type:z.literal('prepare'),seq }),
  z.strictObject({ type:z.literal('checkpoint'),seq }),
  z.strictObject({ type:z.literal('consume'),seq,item:z.enum(['food','water']) }),
  z.strictObject({ type:z.literal('quest'),seq,action:z.enum(['accept','claim','abandon']),quest:z.string().min(1).max(32) }),
  z.strictObject({ type:z.literal('party'),seq,action:z.enum(['create','invite','join','leave']),target:id.optional() }),
  z.strictObject({ type:z.literal('revive'),seq,target:id }),
  z.strictObject({ type: z.literal('heal'), seq }),
  z.strictObject({ type: z.literal('respawn'), seq }),
  z.strictObject({ type: z.literal('ping'), sent: z.number().finite().nonnegative() })
]);
export type ClientMessage = z.infer<typeof ClientMessage>;
export type Intent = Exclude<ClientMessage, { type: 'hello' | 'ping' }>;
export type ServerMessage =
  | { type: 'welcome'; version: number; token: string; playerId: string; seq: number; tick: number; entities: Entity[] }
  | { type: 'delta'; tick: number; upsert: Entity[]; remove: string[] }
  | { type: 'reject'; reason: string }
  | { type: 'pong'; sent: number }
  | { type:'activity';map:string;event:{kind:string;remaining:number;contributors:number}|null;party:{id:string;map:string;hp:number}[];invitations:string[] };
