# Project LAST HAVEN — Core Agent Instructions

## Mission
Build a browser-first isometric survival MMORPG with persistent social towns, survival exploration, free-form sandbox housing, PvE/PvP, protected house raids, persistent AI survivors, voice chat, seasons, rankings and fair premium systems.

This file is the top-level contract for any design or coding agent working in this repository.

## Product invariants

### Browser first
- Primary launch target: desktop browser.
- Rendering: isometric 2D/2.5D, not photorealistic 3D.
- Optimize for mid-range laptops and integrated GPUs.
- Core game must not require a native client.

### MMORPG first
- The persistent world is the product; expeditions are not the whole game.
- Players must be able to log in, stand in a shared town, see others, chat, trade, party, join guild activity, accept quests, visit homes and travel to danger zones.
- Baseline world topology: shared towns + channelized/instanced adventure maps.

### Server authoritative
The client is never authoritative for movement validity, combat hits/damage, inventory, drops, crafting, currency, trades, raid results, gacha results, quest completion or NPC-owned items.

The client sends intent; the server validates and applies state.

### AI is not the rules engine
AI/LLM may control dialogue, personality expression, memory recall, opinions, high-level goals and suggested tactical intent.

AI/LLM must not directly grant items, create currency, resolve combat, change stats, bypass quests, mutate inventory or decide authoritative rewards.

All AI actions must use a validated structured-action schema.

### Sandbox housing is free-form
Housing is not a fixed room-upgrade tree. Players must be able to place and arrange floors, walls, doors, windows, furniture, workstations, storage, crops, traps, defenses and decoration.

Technical placement limits are allowed, but visual and tactical freedom are core product requirements.

### Protected PvP
- Towns are safe.
- PvP risk varies by zone.
- House raids use matchmaking/protection rules.
- A raid must not permanently delete months of progress.
- Use partial loot loss, vault protection, cooldowns and power-band matchmaking.

### Fair monetization
Premium systems may focus on cosmetics, housing themes/decor, skins, emotes, battle/season passes and convenience that does not dominate competitive power.

Do not make direct PvP power the core purchase.

### Soft seasonal reset
Seasonal ratings, ladders and temporary territory may reset. Persistent identity should generally remain: character identity, housing, collections, cosmetics, achievements and recruited NPC relationships.

## Baseline decisions
Unless superseded by an ADR:
- Camera: fixed isometric.
- Controls: keyboard movement first; architecture must allow click-to-move later.
- Combat: realtime action combat with compact hotbar.
- Party: 4 combat slots for MVP.
- NPC companions: consume party slots initially.
- Town target: 50–100 visible players.
- Adventure map target: 20–50 players.
- Dungeon/expedition target: 1–8 players.
- Death: owner-approved full loss of carried inventory and equipped gear, except premium items; one protection item preserves all other items for one death. Banked storage, XP and character level remain safe. See ADR-003. No player looting/PvP rule is implied.
- Survival: meaningful preparation without constant hunger/thirst micromanagement.
- Housing: sandbox plot; snapping/grid may help placement but should not make layouts feel fixed.
- Raids: protected, limited-loss model.
- NPC acquisition: hybrid world/quest/reputation + premium contracts.
- Platform: desktop browser first.

## Engineering principles
- Prefer boring, proven infrastructure.
- PostgreSQL for durable relational state.
- Redis for presence, queues, matchmaking and ephemeral coordination.
- WebSocket for realtime game traffic.
- WebRTC/SFU for voice.
- Object storage/CDN for assets.
- Start modular, but avoid premature microservices.
- Use fixed-step deterministic game logic where practical.
- Keep RNG server-side and seedable for tests.
- Make items, skills, maps, monsters, recipes, loot tables, quests, NPC archetypes and building pieces data-driven.
- Version all persistent schemas/content.
- Add structured observability from the first phase.

## Recommended repository layout
```text
/apps
  /web-client
  /game-server
  /admin
/services
  /ai-orchestrator
  /voice-signaling
/packages
  /protocol
  /game-rules
  /content-schema
  /shared-types
/infra
/docs
/tests
```

## Agent workflow
1. Read `AGENTS.md`.
2. Read `ROADMAP.md`.
3. Read the current phase file.
4. Read relevant ADRs.
5. Inspect existing code before creating new structure.
6. Make the smallest complete change that satisfies the current phase/task.
7. Add/update tests.
8. Add migrations/schema versioning when needed.
9. Update docs/interfaces when behavior changes.
10. Run lint/tests/build.
11. Summarize changes, tests, risks and blocked dependencies.

Do not silently change product rules.

## Definition of done
A task is not done until:
- code builds,
- lint/types pass,
- relevant tests pass,
- failure states are handled,
- no secrets are committed,
- authoritative validation exists where needed,
- important state changes are logged/telemetry-ready,
- docs are updated,
- new persistent data has a migration/version plan.

## Security and anti-cheat baseline
Required:
- JWT/session validation,
- rate limits,
- server authority,
- server-side inventory/currency,
- replay/duplicate protection for economy events,
- transactional trade/crafting/raid rewards,
- audit ledger for premium currency,
- anti-spam for chat/voice signaling,
- validation of all AI structured actions.

Never trust client price, damage, item count, movement distance, cooldown completion or gacha outcome.

## Performance baseline
- Target 60 FPS ordinary play on target desktop hardware.
- Graceful degradation to 30 FPS in crowded events.
- Cull off-screen entities.
- Use interest management for replication.
- Use atlases and object pooling.
- Do not send full world state every tick.
- Keep AI inference outside realtime combat loop.

## Human approval gates
Stop and request owner review before changing:
- monetization model,
- death/full-loot rules,
- party size,
- PvP safety model,
- raid loss rules,
- seasonal reset policy,
- NPC acquisition fairness,
- world topology,
- premium currency behavior.
