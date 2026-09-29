# ADR-003: Phase 2 gameplay, world instances and recovery

Accepted for the local Phase 2 prototype. Death policy was explicitly decided by the owner in this chat; other decisions preserve the existing world topology, town safety and four-combat-slot cap.

## Owner-approved death policy

The owner replaced 10% scrap loss with: “if die lose all the item unless have protection,” then confirmed **carried inventory and equipped gear are lost** and **premium items always survive; one protection item is consumed to protect all other items for one death**. Banked storage, XP and character level remain safe.

The server gives a 20-second downed window. A nearby living party member can consume one bandage to restore 35% HP before full death. This avoids loss entirely. Otherwise full death resolves once: consume one protection charge if available; if not, remove non-premium owned weapons, scrap, bandages, food, water and ammunition. Equipped premium weapons and premium item stacks survive. A lost equipped weapon falls back to unarmed combat. The implementation currently has weapons, not armor; future equipment types must apply the same policy.

Lost items are removed, not made into player-lootable corpses. This does not enable PvP. Recovery uses a selected checkpoint; Haven preparation gives basic supplies and a pipe when no weapons remain, so a player can continue. Quest-earned protection demonstrates the policy without adding a store, currency or payment system. Premium flags exist only in server-owned inventory data; no client packet can grant or relabel an item as premium.

## World and combat

Use one modular Node process with four map simulations sharing one tick clock. Haven is a safe shared town. Forest/Road are adventure instances and Hospital is an interior instance. Metadata defines capacity, safe zones, portals, resources, spawns, hazards and events. Map capacity is checked before removing the player from the source. Replication includes only the current map; party activity also reports cross-map member health/location. More channels and durable handoff belong to Phase 3.

PvP and friendly fire remain disabled. Attacks are explicit single-target intents, including shotgun (short-range high damage in this slice); no auto-attack. Target selection never bypasses range, line of sight, cooldown, stamina or ammunition checks. Server-side deterministic pathfinding supplies monster steering. Threat prioritizes players who damage a monster; safe-area players cannot be attacked. Three skills provide stagger, temporary damage reduction and nearby living party healing. No LLM is involved.

Party cap stays four. Invite/accept is explicit, invites expire, and the leader role transfers on departure. Nearby living members receive shared kill XP/quest credit. A kill drop remains one shared pickup, reserved to the killer/current party for ten seconds, then public; pickup is never duplicated per member. Public events use actual damage, pickup or escort contribution and resolve rewards once. The horde event is the initial defend-perimeter objective: clear the three attackers before timeout.

## Versioning and durable-state plan

Protocol v2 adds map-aware entities, player progression/inventory metadata, actions and activity messages. Content v2 adds map/quest/event tables and weapon/skill definitions. No database existed and none is added here; restart still resets sessions, inventories, parties, quests and events.

Phase 3 must migrate these ephemeral structures into versioned character/progression, inventory-instance (including premium origin), quest completion, checkpoint and reward-ledger tables. Protection consumption, item removal and death ledger entry must become one transaction keyed by a death occurrence ID; quest/event claims similarly need unique durable claim keys. A server restart cannot yet preserve or replay these guarantees. Do not deploy this prototype for purchased items.

## Remaining acceptance

Automated checks cover the core rules and WebSocket map handoff. Browser/phone rendering, four-browser play, survival tuning and target-hardware FPS remain unverified after prior browser access denial. No production or persistence claim is made.
