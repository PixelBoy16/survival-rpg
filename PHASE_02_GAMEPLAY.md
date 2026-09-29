# Phase 2 — World, Combat, Survival and Progression

## Objective
Build the first complete PvE loop:
**Town → prepare → enter zone → fight/explore/gather → complete objective → return → gain progression.**

## Implementation checklist — 2026-09-29

- [x] Versioned map metadata and Haven Town, Forest, Abandoned Road, Hospital.
- [x] Server-validated portals, map capacity, spawn points and checkpoints.
- [x] Safe town/arrival areas, environmental hazards and per-map replication.
- [x] Melee, pistol, rifle and shotgun stats, ammo and equipment ownership/level checks.
- [x] Primary attacks plus Bash, Guard and Rally active skills; costs, cooldowns and effects.
- [x] Walker (internal ID `shambler`), Runner, Crawler, Elite; deterministic navigation/threat and behavior states.
- [x] Hunger/thirst depletion, injury penalties, exposure damage, food/water and town preparation.
- [x] Downed window, party revive, checkpoints and owner-approved full-death item protection/loss.
- [x] XP, levels, basic HP/damage scaling, weapon mastery counter and skill unlocks.
- [x] Data-driven kill/collect/interact/escort/visit/survive/defend objectives and one-time quest rewards.
- [x] Timed horde, supply and NPC rescue events; contribution tracking, expiry and one-time rewards.
- [x] Four-slot invited parties, member state/markers, shared nearby kill credit and reserved party loot.
- [x] Desktop/mobile field journal and buttons for preparation, travel, gear, skills, quests and party actions.
- [x] Structured gameplay/recovery/event/zone/survival telemetry.
- [x] Automated town-to-zone-and-return quest loop, event, safety, inventory loss and multiplayer checks.
- [ ] Browser playtest: actual control feel, visual clarity and four-client combat session.
- [ ] Balance review: survival pressure, weapon/skill tuning, event timing and death messaging.
- [ ] Reconfirm target-hardware performance for the expanded scene.

Phase 2 prototype code is implemented. Final Phase 2 verification: all 31 tests, types, lint and both production builds passed. The checklist is complete for implemented/automated work; gameplay acceptance remains open until the unchecked hands-on checks above are verified. Phase 3 starts at the owner's explicit request without marking those checks as done. See [playtest](docs/PHASE_02_PLAYTEST.md) and [ADR-003](docs/adr/ADR-003-gameplay.md). Live gameplay state is still in-memory until the Phase 3 persistence wiring and recovery tests are completed.

## World/map model
Map definitions must be data-driven with:
- map_id,
- map_type,
- recommended level,
- PvP policy,
- max players,
- environment tags,
- spawn/resource/event tables,
- exits/portals,
- safe areas.

Initial maps:
- Haven Town,
- Forest,
- Abandoned Road,
- Hospital interior.

Support map transitions, spawn points, checkpoints and environmental hazards.

## Combat
Implement:
- primary attack,
- 3–4 active skills,
- stamina/resource costs,
- cooldowns,
- hit validation,
- status effects,
- healing,
- revive,
- aggro/threat,
- basic target selection.

Initial weapon archetypes:
- pistol,
- rifle,
- shotgun,
- melee.

All combat resolution remains server-authoritative.

## Monsters
Initial archetypes:
- Walker,
- Runner,
- Crawler,
- Elite.

Behavior states:
- idle,
- roam,
- investigate,
- chase,
- attack,
- stagger,
- dead.

No LLM in monster combat.

## Survival
Implement moderate:
- hunger,
- thirst,
- injury,
- infection exposure.

Survival should change preparation and route choice, not require constant maintenance.

## Death/recovery
Owner-approved update (supersedes the earlier partial-loss baseline):
- Full death loses all carried inventory and equipped gear.
- Premium items always survive.
- One protection item is consumed to preserve all other items for that death.
- Banked storage, XP and character level remain safe.
- Party revive during the downed window avoids full-death loss.
- No premium purchase flow or PvP looting is introduced by this decision.

Keep loss policy configurable.

## Progression
Implement:
- player level,
- XP,
- simple stats,
- equipment requirements,
- weapon mastery placeholder,
- skill unlocks,
- quest rewards.

Do not build final endgame tree yet.

## Quest framework
Data-driven objectives:
- kill,
- collect,
- interact,
- escort,
- visit,
- survive timer,
- defend point.

Server validates every completion condition.

## World events
First events:
- infected horde,
- supply crate,
- NPC rescue.

Need timed activation, participant tracking, contribution and reward logic.

## Party combat
Implement:
- party creation stub,
- shared member markers,
- revive,
- loot policy,
- quest credit,
- member state replication.

Baseline cap: 4 combat slots.

## Acceptance criteria
- Full town-to-zone-and-back loop works.
- Monsters path/attack correctly.
- Loot, XP and quest rewards are server-owned.
- Survival matters without feeling oppressive.
- Death/respawn is understandable.
- Public event works for multiple players.
- Four players can fight together.

## Telemetry
Track:
- deaths by cause,
- average zone duration,
- damage sources,
- item drops/pickups,
- event participation,
- consumable use,
- survival depletion,
- mission abandon rate.

## Decisions
- exact death loss,
- friendly fire,
- targeting model,
- auto-attack yes/no,
- loot ownership rules,
- personal vs shared drops,
- revive rules.
