# Phase 5 — Sandbox Housing, Visiting and Raids

## Objective
Make housing a free-form creative system and a strategic raid/defense system.

## Housing plot
Each player receives a persistent plot with:
- plot_id,
- owner_id,
- plot size,
- expansion tier,
- build bounds,
- object budget,
- structure version,
- permissions,
- raid state.

## Building system
Placeable categories:
- floor,
- wall,
- door,
- window,
- stairs,
- roof,
- fence,
- gate,
- furniture,
- light,
- storage,
- workstation,
- farm,
- generator,
- defense.

Required UX:
- placement preview,
- valid/invalid highlight,
- optional snap/grid,
- rotate,
- move,
- demolish,
- collision validation,
- overlap rules,
- server-authorized placement.

Client may preview placement, but server authorizes the final build state.

## Persistence format
Store housing as a versioned object graph:
- template_id,
- transform,
- state,
- owner,
- functional metadata.

Do not persist arbitrary raw client scene state.

Support migrations when building pieces change.

## Functional stations
Objects can provide:
- crafting,
- healing,
- farming,
- storage,
- NPC jobs,
- defense,
- power/water.

Keep utility dependencies simple in the first version.

## NPC life in housing
Support:
- assigned bed,
- assigned job,
- idle location,
- work state,
- guard post.

Ambient movement must not require LLM inference.

## Visiting
Permissions:
- private,
- friends,
- guild,
- public.

Visitors may walk, inspect, talk and use explicitly allowed stations.

## Defense
Initial defenses:
- barricade,
- trap,
- alarm,
- camera,
- turret,
- guard post,
- vault.

All defense behavior is server simulated.

## Raid matchmaking
Match using:
- shelter power,
- defense rating,
- character/progression band,
- recent raid cooldown,
- eligibility/opt-in rules.

Avoid repeated targeting of one player.

## Raid flow
1. Scout target.
2. Pay/initiate raid cost if configured.
3. Create raid instance.
4. Load defender house snapshot.
5. Breach defenses.
6. NPC guards defend.
7. Defender may join if rules allow.
8. Attacker reaches eligible loot.
9. Extraction window begins.
10. Server transactionally commits result.

## Protection rules
Baseline:
- house layout is never permanently destroyed,
- only designated raid-pool value is stealable,
- vault protects resources,
- cooldown after raid,
- offline protection modifiers,
- anti-boosting detection.

## Acceptance criteria
- Players can create meaningfully different layouts.
- Layout persists across restart.
- Invalid overlapping/cheat placement is rejected.
- Friends can visit.
- Raid loads an exact safe snapshot.
- Raid result is transactional.
- Defender cannot lose more than configured cap.

## Decisions
- plot dimensions,
- maximum floors,
- object budget,
- structural support rules,
- raid opt-in vs universal eligibility,
- online defender behavior,
- max loss percentage,
- cooldown,
- insurance/repair rules.
