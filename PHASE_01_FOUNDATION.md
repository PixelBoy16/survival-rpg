# Phase 1 — Product Foundation and Playable Vertical Slice

## Objective
Prove the core feel of Project LAST HAVEN in a browser before investing in MMO-scale infrastructure. The output should be a small but real game, not a menu prototype.

## Implementation status — 2026-09-29

Rechecked before Phase 2: type checking, lint, all 14 automated tests and production builds pass. See [architecture](docs/ARCHITECTURE.md), [protocol](docs/PROTOCOL.md) and [performance report](docs/PERFORMANCE_BASELINE.md).

- [x] Repository layout, local development launcher and CI checks.
- [x] Versioned, runtime-validated protocol and entity/session conventions.
- [x] Connect, join, snapshots, deltas, disconnect and session resume.
- [x] Isometric renderer, tile map, follow camera and zoom.
- [x] Desktop keyboard/click-to-walk preference and mobile joystick/actions.
- [x] Selection, procedural animation states, HUD, HP/stamina and prompts.
- [x] Fixed-tick server movement, collision and server-planned routes.
- [x] Validated combat, cooldowns, damage, infected death and respawn.
- [x] Server-owned loot, protected pickup and replay rejection.
- [x] Test map, player, two weapons, healing item, two infected and supply cache.
- [x] Latency toggle, debug overlay, RTT/FPS/frame-time/entity/network metrics.
- [x] Unit tests and two-WebSocket-client replication/reconnect tests.
- [x] Protocol/architecture docs, ADRs and synthetic server performance report.
- [ ] Visual verification in two real browser clients (access previously denied).
- [ ] Mobile touch and portrait/landscape physical-device playtest.
- [ ] Ten-minute interactive responsiveness/stability acceptance.
- [ ] Measured near-60 FPS on target integrated-GPU hardware.

Code-level foundation is implemented; the Phase 1 exit gate remains open. Phase 2 starts at the owner's explicit request without relabeling unverified checks as complete.

The exit gate remains open: browser access was denied by the browser security tool, so visual verification, two-browser play and ten-minute target-hardware FPS/responsiveness checks are pending. The accelerated server benchmark is recorded separately and does not substitute for those checks. Use [the playtest checklist](docs/PLAYTEST.md) to finish acceptance.

## Client scope
Implement:
- isometric renderer,
- camera follow and zoom,
- keyboard movement,
- aim/selection interaction,
- sprite animation state machine,
- tile/map rendering,
- collision/debug overlay,
- hotbar,
- HP/stamina,
- target/interact prompts,
- ping/network indicator.

Recommended starting stack:
- TypeScript,
- Phaser or PixiJS,
- React only for complex meta/UI screens if needed,
- shared TypeScript protocol package.

## Server scope
Implement:
- authoritative player transform,
- fixed simulation tick,
- one map instance,
- movement/collision validation,
- attack request validation,
- cooldowns,
- damage,
- monster health/death,
- server-owned loot spawn/pickup.

## Initial content
Create:
- 1 test map,
- 1 player archetype,
- 2 weapons,
- 1 healing item,
- 2 infected types,
- 1 interactive loot container.

## Work breakdown
1. Create repository layout and local development environment.
2. Define protocol version and shared message schemas.
3. Define entity/session ID conventions.
4. Implement WebSocket connect/disconnect/reconnect.
5. Implement initial snapshot and delta updates.
6. Implement join/spawn.
7. Implement fixed server tick.
8. Implement movement intent and validation.
9. Implement collision.
10. Implement attack intent and cooldown validation.
11. Implement damage/death.
12. Implement loot spawn and pickup.
13. Implement HUD and hotbar.
14. Add latency simulation developer toggle.
15. Add debug state/entity overlay.
16. Add metrics: FPS, frame time, RTT, entities rendered, network bytes/sec.

## Non-goals
Do not build yet:
- full durable persistence,
- guilds,
- voice,
- housing,
- marketplace,
- AI LLM integration,
- gacha,
- production autoscaling.

## Acceptance criteria
- Two browser clients can connect locally.
- Both can move and see each other.
- Server rejects invalid movement.
- Player can kill infected.
- Loot is granted only by server.
- Invalid attack/cooldown packets are rejected.
- Normal test scene can approach 60 FPS on target hardware.
- Reconnect after short network interruption works.
- Protocol is typed and documented.

## Tests
Required:
- movement validation unit tests,
- cooldown/damage tests,
- loot ownership/pickup tests,
- duplicate/replay request tests where applicable,
- two-client integration smoke test.

## Agent deliverables
- runnable local environment,
- protocol documentation,
- architecture note,
- tests,
- performance baseline report,
- ADRs for major decisions.

## Decisions to record
- Phaser vs PixiJS,
- world unit/grid convention,
- server tick rate,
- movement model,
- animation pipeline,
- prediction/interpolation strategy,
- timing for click-to-move support.
