# Phase 3 — Persistent Multiplayer MMO Backend

## Objective
Convert the game into a persistent multiplayer service with shared towns, channelized maps, reconnect support and durable player state.

## Logical architecture
Minimum logical components:
- API/auth,
- realtime world server,
- persistence module,
- Redis/presence layer,
- matchmaking/channel manager,
- inventory/economy transaction module,
- social/chat module,
- telemetry pipeline.

Do not split each logical component into its own deployment until justified.

## Persistence
Use PostgreSQL for:
- account,
- character,
- progression,
- inventory/equipment,
- quest state,
- currencies,
- housing metadata,
- guild membership,
- NPC ownership,
- season state.

Use Redis for:
- presence,
- matchmaking,
- short-lived locks,
- realtime routing,
- rate limiting,
- transient session/map coordination.

## World channels
Support:
- town channel,
- adventure channel,
- private/party instance,
- dungeon instance,
- house instance.

World manager responsibilities:
- create channel,
- allocate player,
- track population,
- route reconnect,
- retire idle channels.

## Interest management
Never replicate full map state to all players.

Implement:
- spatial AOI,
- enter/leave interest,
- priority updates,
- lower frequency for distant noncritical entities.

## Session/reconnect
Required:
- access token,
- game session token,
- single active character rule,
- reconnect grace period,
- last safe state,
- duplicate connection handling,
- crash-safe checkpointing.

## Inventory/economy transactions
Use transactional/idempotent operations with operation IDs for:
- pickup,
- purchase,
- craft,
- trade,
- reward,
- raid loot,
- premium grants.

Create ledger/audit events for currency changes.

## Chat baseline
Channels:
- nearby,
- town,
- party,
- whisper,
- system.

Add rate limits, mute, block and moderation hooks.

## Anti-cheat
Validate:
- speed/teleport distance,
- attack rate,
- impossible casts,
- duplicated operations,
- fake pickups,
- invalid currency mutation,
- invalid map transitions.

Create security-event logging.

## Load simulation
Create headless clients that can:
- idle in town,
- move,
- chat,
- fight,
- transfer maps,
- reconnect.

## Acceptance criteria
- 50+ simulated clients can occupy a town channel in dev test.
- channels allocate/retire correctly,
- inventory persists across restart,
- reconnect restores player safely,
- duplicate economy requests cannot duplicate value,
- chat is rate limited,
- AOI materially reduces network volume.

## Decisions
- cloud provider,
- deployment boundaries,
- tick rate under load,
- PostgreSQL HA,
- Redis topology,
- channel population target,
- checkpoint interval.
