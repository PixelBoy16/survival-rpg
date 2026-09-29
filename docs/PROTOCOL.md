# Wire protocol v2 / content v2

Transport: UTF-8 JSON on `/socket`, WebSocket, maximum 2 KiB inbound. Binary packets and unknown properties are rejected. Runtime schemas/types: `packages/protocol/src/index.ts`; entity/progression types: `packages/shared-types/src/index.ts`. Version 2 replaces v1 for map-aware gameplay; an old client must reload before joining.

IDs use `<kind>_<alphanumeric-or-hyphen suffix>`: `player_<UUID>`, `infected_forest-1`, `resource_forest-wood`, `party_1`. Counters are process-local. Bearer tokens are independent random UUIDs, never player IDs or premium credentials. All state is ephemeral and resets with the process.

## Session and sequencing

Send `{"type":"hello","version":2}` within five seconds, or include the existing `token` to resume. Welcome contains version, secret token, playerId, last sequence, tick and the initial same-map spatial-interest snapshot. Tab session storage retains the token. Disconnected sessions remain in simulation for 30 seconds; movement stops, but death/recovery/event time continues. Resume retains map, progression, inventory and sequence. A replacement socket closes the previous socket. Invalid/expired tokens are rejected, then the client can create a new local character.

Every gameplay intent contains a safe integer `seq >= 1`, strictly increasing for the session. Validly shaped rejected requests consume sequence; malformed packets do not. Reconnect resumes above welcome.seq. The socket determines the actor; no command accepts an actor ID, damage, reward, item amount, premium tag, quest count or completed cooldown.

## Client intents

| Type | Fields besides type/seq | Server validation |
|---|---|---|
| move | x,y normalized direction | Speed, bounds/collision, life state; expires in six ticks |
| navigate | x,y destination | Bounded pathfinding; endpoint/segments walkable; refreshed at 20 Hz, six-tick expiry |
| attack | target | Infected only, safe-area policy, range/LOS, weapon, ammo, cooldown, stamina |
| equip | weapon | Owned gear and required level; fists always available |
| skill | skill: bash/guard/rally; optional target | Unlock, cost, cooldown, target/range where required |
| interact | target | Same map, distance/LOS, stock/ownership; server pickup/escort effects |
| heal | none | Bandage count, HP and recovery cooldown |
| consume | item: food/water | Owned count and non-full need |
| travel | portal | Defined current-map portal, proximity/LOS, destination capacity |
| prepare | none | Living, near Haven arrival; free prototype starter supplies/rest |
| checkpoint | none | Near current-map checkpoint |
| respawn | none | Full death resolved; checkpoint capacity; no premature bypass of revive window |
| revive | target | Living actor, same party/map, downed target, range/LOS, bandage |
| quest | action: accept/claim/abandon; quest | Data-defined quest, active/completed state, authoritative counts; accept/claim near Haven arrival |
| party | action: create/invite/join/leave; optional target | Leader invite, explicit invited join, expiry, four-slot cap; invite target is player ID, join target is party ID |
| ping | sent; no seq | Finite nonnegative timestamp echoed unchanged |

Version 2 weapon enum: fists, pipe, hatchet, pistol, rifle, shotgun. Names/requirements are content-defined. All inventory amounts are mutated server-side. No purchase or premium-grant request exists.

## Server messages

- `welcome`: version, token, playerId, seq, tick, entities (initial spatial-interest snapshot).
- `delta`: tick, upsert (complete changed records), remove (deleted/out-of-map/out-of-interest IDs). Map transitions remove old-map entities and add new-map records within one update. Entities carry `mapId`.
- `activity`: current map, active event kind/time/contributor count (or null), party member IDs/HP/maps, pending party invitations. Sent once per simulation second; nearby gameplay deltas run at configured 10, 15 or 20 Hz; distant changes are limited to approximately 5 Hz.
- `reject`: bounded reason such as schema, malformed, session, session_expired, replay, destination, range, cooldown, stamina, ammo, not_owned, locked, safe_area, dead, revive_window, ownership, empty, town_only, portal_range, map_full, checkpoint_range, quest_incomplete, quest_active, party_full, party_invite_required or revive_unavailable.
- `pong`: echoed sent.

Entity state includes transform, facing/animation, kind, HP/stamina, weapon, inventory counters, map, loot reservations/expiry, optional AI/effect/event fields, and player progression. Progression includes level/XP, needs, injury/exposure, ammo/food/water, mastery, banked scrap, checkpoint/downed/dead state, owned gear with premium-origin flags, premium item stacks, protection count, party ID, quest counters/completions and skill cooldown ticks. The owning client displays these fields and never edits server state directly. Peers receive the public projection described below. Logical tick timestamps remain in 50 ms units at every configured simulation rate.

## Local security and limits

Anonymous prototype sessions are not account authentication. The server binds loopback and allows only the local Vite browser origins. Production requires real accounts, TLS and durable transactions/ledgers. Other players have progression omitted and carried scrap/bandage counters zeroed; public party IDs remain available for markers. Only the owning client receives its full progression.

Limits: 40 messages/second with burst 80, sustained-flood disconnect, 100 sockets/sessions, 128 KiB outbound backpressure limit. Map capacity is content-defined (100 town, 50 adventure, 8 hospital). State changes and claims are synchronous in one process, so duplicate packets cannot double-grant within a session. Durable replay protection across restarts is Phase 3 work.

