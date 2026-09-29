# Foundation, gameplay and initial multiplayer backend

Phase 2 adds `packages/game-rules/src/game.ts` as the coordinator of four `World` simulations: Haven, Forest, Road and Hospital. It owns map transitions, progression, survival, quests, parties, event lifecycles and recovery. Map/content metadata is in `packages/content-schema/src/world.ts`. All worlds advance on the same fixed clock. The server now instantiates `Game`; the original default `World` test yard remains an isolated regression-test fixture.

The client rebuilds terrain and static obstacle views when its authoritative map ID changes, cancels old navigation, and renders a field journal for server-owned gameplay state. Each socket receives nearby changes only for its current map, plus party activity across maps. Spatial cells are rebuilt once per update; the radius is 10 tiles and distant changed records are throttled. Other players receive a public projection without private progression. Protocol v2 carries progression, owned weapon/premium metadata and activity. Content is version 2. See `adr/ADR-003-gameplay.md` for recovery and the future persistence migration plan.

`apps/web-client` uses PixiJS for an isometric map, procedural sprite frames, camera, selection and pooled entity views. HTML/CSS supplies the compact HUD and developer controls. No React or backend UI framework is needed. `apps/game-server` serves WebSockets and health metrics. `packages/game-rules` owns deterministic tick advancement and all game mutations. `packages/content-schema` holds versioned map/archetype/weapon content; `packages/protocol` owns packet validation and types; `packages/shared-types` holds the wire entity model. The root package installs one dependency graph and lockfile for the monorepo.

The server advances four maps with a configurable 10, 15 or 20 Hz fixed step (default 20), at most five catch-up steps, and explicit overrun telemetry. Invalid movement vectors never reach simulation. Movement is speed-limited per tick, collision-tested per axis, and stops when input is stale. There are no client delta-time or position inputs. Attacks require a living infected target, distance and line of sight, server cooldown and stamina. No PvP damage path exists. Weapon selection requires owned gear and the required level.

Desktop control choice is saved locally: keyboard movement or click-to-walk. Click destinations are inverse-projected through the current camera and sent as `navigate` intents. The server owns bounded grid routing, endpoint validation and path following. Mobile/coarse-pointer devices instead use an analog joystick and touch action buttons. See `adr/ADR-002-controls.md`. Route starts emit `navigation_start`; stale input, disconnect and direct movement cancel the path.

Infected pursue nearby players with deterministic pathfinding, threat and melee cooldowns. Kills spawn owner/party-reserved salvage (10 seconds), expiring after 60 seconds; normal infected respawn after 15 seconds. Event infected do not respawn. Resource nodes replenish after two minutes. Player death now uses the owner's approved policy: a 20-second revive window followed by loss of ordinary carried items and equipped gear, with premium-item survival and one-use inventory protection. Banked storage, level and XP survive. Party revive avoids full death. Only the isolated legacy World tests retain the old three-second no-loss reset.

Each connection has a validated anonymous session. Disconnect stops movement immediately but leaves the character in the simulation, vulnerable to infected, for 30 seconds. Resume retains inventory and request sequence. Economy requests mutate server state synchronously, so race/duplicate pickups cannot grant twice. No durability is claimed: all state is discarded on restart. Phase 3 adds a versioned PostgreSQL migration and transactional checkpoint/ledger adapter, plus Redis coordination primitives. These are not wired into gameplay yet. Content and wire versions are both 2; see PHASE_03_BACKEND.md for persistence boundaries.

The client displays server state with exponential smoothing (~55 ms) and an independent following camera. It does not predict authoritative positions. This favors correctness during the foundation slice; latency modes expose the resulting input delay. Changed entity records are broadcast at tick boundaries, without re-sending unchanged entities. Terrain and procedural sprite textures are shared, views are pooled, and off-screen entities are hidden. Per-client interest sets track entry, departure and last-sent public state. Unchanged snapshots are suppressed; low-frequency heartbeat and party activity continue.

Logs are JSON: player_spawn, session_join, session_disconnect, damage, player_down, respawn, heal, loot_spawn, loot_pickup, container_pickup, tick_overrun, socket_error and periodic metrics. Tokens are never logged. `/health` reports tick cost, connection/rejection counts, entities, sessions and outbound bytes. Browser HUD reports FPS, frame time, RTT, visible entities and bidirectional application bytes/s (excluding WebSocket framing). F3 adds IDs/positions, server tick and obstacle outlines.

## Limits and failure behavior

- Local-only foundation; no accounts, durable persistence, real money, production hosting or MMO-scale claim.
- Renderer initialization failure produces a visible WebGL error. Network failures freeze commands, show reconnect status and retry with capped exponential backoff.
- Invalid messages return bounded rejection codes. Rate limits, payload limits, origin checks, session caps and backpressure bound prototype resource use.
- Monster steering now routes around static walls; dynamic crowds and authored navmesh/pathfinding polish remain future work.
- Server restart removes sessions, container stock changes and temporary inventory. The client rejoins with a new player after an expired-token response.
- Owner review gates remain in force. Death policy D-010 was explicitly changed by the owner and recorded in ADR-003; the four-slot party cap, safe towns and lack of PvP remain unchanged.

See `PROTOCOL.md`, `PERFORMANCE_BASELINE.md`, and `adr/ADR-001-foundation.md`.

