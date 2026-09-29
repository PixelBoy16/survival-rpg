# Phase 1 baseline — 2026-09-29

## Phase 2 recheck

The original 14-test foundation suite passed before Phase 2 work. The expanded suite now has 31 passing tests, including map replication, quests, skills, four-slot party rules, events, survival, revive and approved death protection. Type checking, lint and production builds pass. The current main client JavaScript chunk is about 393 KB (122 KB gzip), plus lazy Pixi renderer chunks.

`pnpm benchmark:gameplay` advances all four map simulations for 12,000 ticks with 2 or 50 simulated players in Forest, normalized movement intents, downed/death/respawn handling, public events and full-state JSON serialization. It runs faster than real time; it is not a browser FPS or network load test.

| Players | Simulated duration | Mean tick + intents/serialization | p95 | Maximum | Final entities |
|---:|---:|---:|---:|---:|---:|
| 2 | 600 s | 0.2392 ms | 0.9476 ms | 4.1173 ms | 15 |
| 50 | 600 s | 0.4447 ms | 0.7489 ms | 2.4525 ms | 63 |

All measured ticks were below the 50 ms simulation budget on this development host. Different player paths/AI activity can make a smaller run's p95 higher than a larger one; these are scenarios, not a scaling guarantee. Browser visuals, actual four-client gameplay, mobile touch and target-GPU FPS remain pending. The Phase 1 measurements below are historical and should not be substituted for this expanded scenario.

## Verified

Environment: this Windows development host, bundled Node runtime, production Vite build. Dependencies are locked by `pnpm-lock.yaml`. Run `pnpm benchmark` to reproduce the CPU test.

The benchmark advances 12,000 fixed ticks (600 seconds of simulation) as fast as the CPU permits, submits movement/respawn intents for every simulated player, and serializes full entity state each tick. These are CPU measurements, not 600 seconds of elapsed browser play or network throughput.

| Simulated players | Ticks | Mean step incl. intents/serialization | p95 | Maximum | Final entities |
|---|---:|---:|---:|---:|---:|
| 2 | 12,000 | 0.0043 ms | 0.0068 ms | 0.8670 ms | 5 |
| 50 | 12,000 | 0.0337 ms | 0.0534 ms | 0.5005 ms | 53 |

Budget is 50 ms per simulation tick. These low entity-count synthetic runs leave substantial CPU headroom but do not establish supported production concurrency. Real WebSocket broadcasting, network jitter and GPU rendering are outside this benchmark. First-run/JIT and scheduling effects influence maximum timings.

Automated tests cover malformed/forged messages, speed and collision, stale input, cooldown/damage, line of sight, stamina, no PvP damage, owned loot and duplicate pickup, cache depletion, healing, downed-player restrictions, loot expiry/repopulation, two-client movement replication, token resume, preserved inventory/sequence, invalid tokens, authentication ordering and rate limits. Type checking, lint and production builds are also required by `pnpm check`.

Initial client build: approximately 382 KB main JavaScript (118 KB gzip), plus lazy Pixi renderer chunks. Art is generated locally and shared as GPU textures; no external asset downloads or web fonts are needed. Off-screen entities are hidden and entity views are pooled.

## Pending acceptance evidence

- Actual browser FPS/frame times and integrated-GPU target hardware details.
- Two real browser clients' visual correctness, animation and control feel.
- Ten-minute interactive stability session, including latency, focus loss and reconnect.

Browser verification was attempted but the browser security tool denied local URL access, reporting that permission was declined. No alternative browser automation was used. The renderer/HUD are implemented and built, but visual acceptance is explicitly **unverified**. Follow `PLAYTEST.md` to finish the exit gate. Do not infer 60 FPS from the server benchmark.
