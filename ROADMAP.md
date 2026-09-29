# Project LAST HAVEN — Master Implementation Roadmap

## Phase 1 — Product foundation and playable vertical slice
**Goal:** prove the browser game feels good before MMO-scale investment.

Deliver: isometric client shell, movement, camera, one combat loop, one monster, one tiny map, hotbar, health/stamina, authoritative movement/combat, protocol, local multiplayer test and performance metrics.

**Exit gate:** a 10-minute browser session is responsive, stable and cheat-resistant at the basic movement/combat level.

See `PHASE_01_FOUNDATION.md`.

## Phase 2 — World, combat, survival and progression
**Goal:** create the first complete PvE loop.

Deliver: zone model, monster AI, combat, loot, survival, death/respawn, character progression, quests, public events and basic party combat.

**Exit gate:** town → zone → fight/gather/objective → return → progression works end-to-end.

See `PHASE_02_GAMEPLAY.md`.

## Phase 3 — Persistent multiplayer MMO backend
**Goal:** turn the prototype into a persistent online world.

Deliver: authoritative world server, map channels, durable persistence, presence, matchmaking, inventory/economy transactions, reconnect and anti-cheat baseline.

**Exit gate:** many players can share town/adventure maps reliably and state survives restart/reconnect.

See `PHASE_03_MULTIPLAYER_BACKEND.md`.

## Phase 4 — Items, crafting, professions and economy
**Goal:** build a sustainable player economy and progression loop.

Deliver: item schema, equipment, durability, gathering, recipes, stations, professions, direct trade, merchant and marketplace foundation.

**Exit gate:** gather → craft → equip/sell → consume works safely and transactionally.

See `PHASE_04_ECONOMY_CRAFTING.md`.

## Phase 5 — Sandbox housing, visiting and raids
**Goal:** make player-built shelters a creative progression system and a strategic PvP object.

Deliver: free-form building, persistence, plot limits, functional stations, visiting, defenses, raid matchmaking, raid instances and loss protection.

**Exit gate:** two players can create distinct homes and raid each other without destructive griefing.

See `PHASE_05_HOUSING_RAIDS.md`.

## Phase 6 — AI survivors and local AI integration
**Goal:** create persistent survivor personalities without letting AI control authoritative rules.

Deliver: recruitable NPC model, traits, jobs, loyalty/trust, memory, AI gateway, structured actions, dialogue and fallback behavior.

**Exit gate:** NPCs remember significant events and feel different while combat remains deterministic and AI outages do not break gameplay.

See `PHASE_06_AI_NPCS.md`.

## Phase 7 — Social, guilds and voice
**Goal:** create classic MMORPG social stickiness.

Deliver: friends, parties, guilds, chat, party finder, proximity/party/guild/radio voice, moderation and blocking/reporting.

**Exit gate:** players can meet in town, talk, party and travel together smoothly.

See `PHASE_07_SOCIAL_VOICE.md`.

## Phase 8 — Seasons, rankings, gacha and premium systems
**Goal:** add long-term live-service progression and monetization within fairness boundaries.

Deliver: rankings, seasonal resets/rewards, premium currency ledger, cosmetics, survivor contracts, odds disclosure, pity, duplicate shards and admin configuration.

**Exit gate:** a season can be configured, run and reset without harming persistent identity.

See `PHASE_08_LIVEOPS_MONETIZATION.md`.

## Phase 9 — Browser optimization, deployment and scale
**Goal:** harden the game for production.

Deliver: load testing, interest management tuning, asset streaming, CDN, CI/CD, autoscaling, observability, recovery, admin/moderation and SLOs.

**Exit gate:** validated concurrency target, repeatable deploy/rollback and operational readiness.

See `PHASE_09_PRODUCTION_SCALE.md`.

## Cross-phase decision log
Maintain ADRs for:
- control scheme,
- camera limits,
- party/NPC slot policy,
- death loss,
- map channel size,
- house plot/object limits,
- raid protection,
- player trade restrictions,
- premium currency,
- AI runtime,
- seasonal reset.
