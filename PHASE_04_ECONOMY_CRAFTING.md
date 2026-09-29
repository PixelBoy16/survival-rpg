# Phase 4 — Items, Crafting, Professions and Economy

## Objective
Create a sustainable economy loop where exploration produces resources and crafting/housing consume them.

## Item system
Use a data-driven schema with:
- item_id,
- type,
- rarity,
- stack limit,
- durability,
- weight if used,
- bind/trade policy,
- equip slot,
- stats,
- tags,
- vendor value,
- icon/assets,
- content version.

Categories:
- weapons,
- armor,
- consumables,
- ammunition,
- materials,
- tools,
- quest items,
- housing items,
- cosmetics.

## Equipment
Implement:
- equip/unequip,
- slot validation,
- stat calculation,
- durability loss,
- repair,
- appearance binding.

Initial slots:
- primary,
- secondary,
- head,
- body,
- gloves,
- boots,
- accessory x2,
- backpack,
- utility.

## Gathering
Sources:
- world nodes,
- containers,
- monsters,
- salvage,
- events,
- farms.

Resources:
- wood,
- metal,
- cloth,
- plastic,
- electronics,
- chemicals,
- medicine,
- food,
- seeds,
- fuel,
- water,
- infected samples.

## Crafting
Recipe schema:
- inputs,
- station,
- profession requirement,
- craft time,
- output,
- optional quality range,
- unlock method.

First stations:
- workbench,
- medical station,
- kitchen,
- recycler.

## Professions
Initial:
- weaponsmith,
- medic,
- engineer,
- cook,
- builder.

Progress professions through related activity, not passive timers only.

## Economy
Implement:
- NPC merchant buy/sell,
- direct player trade,
- two-sided confirmation,
- atomic trade commit,
- marketplace foundation.

Marketplace must prevent duplicate listings, race double-buy, negative balances and stale ownership.

## Sources and sinks
Sources:
- exploration,
- events,
- quests,
- NPC sales/rewards.

Sinks:
- crafting,
- repair,
- ammo/consumables,
- housing,
- raid preparation,
- marketplace fees.

## Telemetry
Track:
- currency created/destroyed,
- item created/destroyed,
- average market price,
- trade volume,
- top resources,
- repair spend,
- crafting frequency.

## Acceptance criteria
- Player can gather, craft, equip, repair and trade.
- Trade is atomic.
- Craft retries cannot duplicate resources.
- Professions progress.
- Economy dashboards show sources/sinks.

## Decisions
- binding rules,
- marketplace launch timing,
- durability harshness,
- encumbrance yes/no,
- item quality/affix depth,
- auction tax.
