# Project LAST HAVEN

Browser-first isometric survival MMORPG. Phase 1 foundation has been rechecked, and the Phase 2 prototype adds Haven Town, three adventure/interior maps, travel, gathering, quests, progression, survival, four-player parties, public events and protected-item death recovery. Phase 3 has started with spatial replication, configurable tick rates and initial PostgreSQL/Redis adapters. Browser and hardware acceptance remain pending.

## Run locally

Requires Node.js 22+ and pnpm 11+. From the repository root:

```sh
pnpm install
pnpm dev
```

Open **http://127.0.0.1:5173** in two separately opened browser tabs. Game server: `127.0.0.1:3001`; health: `/health` through either server. Both processes bind loopback. Close with Ctrl+C.

On this Windows workspace, dependencies are installed and `powershell -File scripts/dev.ps1` can use the bundled Node runtime when Node is missing from PATH.

Controls: WASD/arrows move, click selects, Space attacks, 1/2 select weapon, 3 heals, E collects nearby supplies/salvage, R respawns after death, wheel zooms, F3 toggles debug. Developer controls simulate latency and short reconnects. Every gameplay result is validated by the server.

Use the **Movement** selector on desktop to choose **WASD / Arrows** or **Click to walk**; the choice is saved. In click mode, click open ground to walk around obstacles, click entities to select, and press Escape to stop. On mobile/coarse-pointer devices, movement uses only the on-screen joystick, with buttons for each action and zoom. Mobile layout does not enable ground-tap walking. Local hosting still binds loopback; physical-phone network deployment is not enabled.

```sh
pnpm check       # types, lint, unit/integration tests, server/client builds
pnpm benchmark   # accelerated ten-minute simulation for 2 and 50 players
pnpm benchmark:gameplay # four-map Phase 2 simulation
pnpm benchmark:aoi # spatial replication comparison
pnpm load:local    # 50 local WebSocket clients and reconnect test
pnpm db:migrate    # requires exported DATABASE_URL; see backend setup
pnpm start       # built game server only; use pnpm dev for the local browser client
```

Live gameplay has no durable storage yet; restart resets all test state. Persistence adapter source and migrations exist but are not connected to gameplay. Anonymous local sessions are not production authentication. Browser playtest and hardware FPS acceptance remain pending; see the report.

Start in **Haven Town** and open **Field journal & actions**. Prepare and accept **Beyond the perimeter**, walk to the Forest portal, then use **Use nearest portal**. Fight/gather, return to town and claim the quest for progression. The journal also contains weapons, three skills, survival consumables, checkpoints, party invitations and revive. See the [Phase 2 playtest](docs/PHASE_02_PLAYTEST.md).

**Owner-approved death rule:** full death loses carried inventory and equipped ordinary gear. Premium items survive; one protection item protects all other items for one death and is consumed. Banked storage, XP and level stay safe. Party revive during the 20-second downed window avoids the loss. This local prototype has no premium purchase system.

- [Architecture](docs/ARCHITECTURE.md)
- [Typed wire protocol](docs/PROTOCOL.md)
- [Recorded foundation decisions](docs/adr/ADR-001-foundation.md)
- [Performance and acceptance status](docs/PERFORMANCE_BASELINE.md)
- [Manual playtest](docs/PLAYTEST.md)
- [Phase 1 completion checklist](PHASE_01_FOUNDATION.md)
- [Phase 2 implementation checklist](PHASE_02_GAMEPLAY.md)
- [Gameplay/recovery decisions](docs/adr/ADR-003-gameplay.md)
- [Phase 3 implementation checklist](PHASE_03_MULTIPLAYER_BACKEND.md)
- [Backend setup and remaining integration](docs/PHASE_03_BACKEND.md)
- [AWS Redis for local testing](docs/AWS_REDIS_DEV.md)
- [Host friends over the internet with local Redis](docs/LOCAL_PLAYTEST.md)
- [Initial multiplayer measurements](docs/PHASE_03_BENCHMARK.md)

## Implementation instructions

Start here:
1. `AGENTS.md` — mandatory global rules for every implementation agent.
2. `ROADMAP.md` — phase order and exit gates.
3. `ARCHITECTURE_DECISIONS.md` — current assumptions and ADR template.
4. The relevant phase file.

## Phase files
- `PHASE_01_FOUNDATION.md`
- `PHASE_02_GAMEPLAY.md`
- `PHASE_03_MULTIPLAYER_BACKEND.md`
- `PHASE_04_ECONOMY_CRAFTING.md`
- `PHASE_05_HOUSING_RAIDS.md`
- `PHASE_06_AI_NPCS.md`
- `PHASE_07_SOCIAL_VOICE.md`
- `PHASE_08_LIVEOPS_MONETIZATION.md`
- `PHASE_09_PRODUCTION_SCALE.md`

## Agent rule
Do not jump ahead to later-phase complexity unless the current phase requires an interface stub.

Each phase ends with working code, tests, docs, telemetry, recorded decisions and explicit known risks.

