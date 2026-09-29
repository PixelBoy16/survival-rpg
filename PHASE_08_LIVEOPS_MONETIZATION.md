# Phase 8 — Seasons, Rankings, Gacha and Premium Systems

## Objective
Create long-term competition and monetization without undermining the core survival/PvP game.

## Rankings
Separate ladders rather than one universal score:
- PvP,
- raid,
- defense,
- boss,
- exploration,
- crafting,
- housing,
- guild.

## Seasons
Season configuration should include:
- season_id,
- start/end,
- content flags,
- ladders,
- reward tracks,
- events,
- reset policies,
- shop banners.

Soft-reset rule:
- reset seasonal ratings/ladders,
- preserve long-term identity, housing, collections and NPC relationships unless owners explicitly change policy.

## Seasonal rewards
Prefer:
- cosmetics,
- titles,
- profile badges,
- housing decoration,
- prestige rewards.

Avoid permanent rewards that create dominant PvP power.

## Premium currency
Requirements:
- append-only ledger,
- idempotent purchase grant,
- purchase receipt validation,
- reversal/refund support,
- admin audit.

Client never owns authoritative premium balance.

## Survivor Contracts / gacha
Must include:
- exact rates,
- pity counter,
- banner duration,
- duplicate conversion,
- shard exchange,
- pull history.

Server performs RNG and records results.

Persist:
- banner version,
- pity state,
- pull history,
- duplicate/shard conversion.

## Premium shop
Initial categories:
- character cosmetics,
- weapon skins,
- housing decor,
- housing themes,
- emotes,
- pets,
- battle pass,
- bundles.

Any gameplay convenience requires explicit fairness review.

## LiveOps admin
Create tools to:
- configure banner,
- schedule event,
- configure drop rate/content flag,
- configure season,
- grant compensation,
- disable broken content,
- inspect premium ledger.

All admin actions must be audited.

## Acceptance criteria
- Season starts/ends automatically.
- Ratings reset according to policy.
- Premium purchases are auditable/idempotent.
- Gacha odds and pity are visible and correct.
- Duplicate conversion is deterministic.
- Shop/season configuration does not require normal code deployment.

## Tests
- premium ledger idempotency,
- pity boundary tests,
- odds configuration validation,
- duplicate conversion tests,
- season rollover tests,
- reward grant replay tests.

## Decisions
- premium currency model,
- regional gacha/compliance requirements,
- survivor stat fairness,
- pity threshold,
- battle pass structure,
- premium item trading restrictions.
