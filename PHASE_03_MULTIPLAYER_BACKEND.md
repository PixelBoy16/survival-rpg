# Phase 3 — Persistent Multiplayer MMO Backend & AWS Game Hosting

## Objective
Convert the playable game into a persistent multiplayer MMO service with shared towns, channelized adventure maps, reconnect support, durable player state, authoritative economy/combat, and an infrastructure model that can scale from closed beta to tens of thousands of concurrent players without a fundamental rewrite.

This phase also locks the initial production cloud and hosting strategy.

## Implementation checkpoint — started 2026-09-29

- [x] Preserve authoritative simulation/intent boundary and Phase 2 regression suite.
- [x] Configurable 10/15/20 Hz scheduler with rate-independent movement and base-clock deadlines.
- [x] Spatial cell AOI, enter/leave deltas, distance-based priority and unchanged-state suppression.
- [x] Keep other players' inventory/progression out of public replication.
- [x] Repeatable AOI comparison and local 50-client/reconnect load harness.
- [x] PostgreSQL identity/checkpoint/operation/append-only-ledger migration source and checksummed migration runner.
- [x] PostgreSQL transactional checkpoint adapter with operation IDs, revision checks and session fencing.
- [x] Redis lease/presence/rate-limit adapter, local Compose configuration and optional service integration tests.
- [x] CI configuration to exercise PostgreSQL/Redis integration tests in service containers.
- [x] AWS Redis development Terraform, private cache/TLS/auth, SSM local tunnel and test runner; configuration and mocked security assertions validated. Deployment/live Redis run pending AWS profile setup.
- [x] Execute real Redis integration locally (Redis 8.0.6 in WSL); add invite-gated internet playtest hosting with Redis login limits and presence.
- [ ] Execute PostgreSQL integration tests locally or in CI.
- [ ] Account authentication/API and live-game durable mutation/checkpoint wiring.
- [ ] Distributed channel manager, private instances, reconnect routing and retirement.
- [ ] Chat/moderation baseline.
- [ ] GameLift SDK lifecycle/placement, ECS packaging and deployable AWS IaC.
- [ ] Full 50/100/150/200 ladder, hotspot scenarios and hours-long soak on the benchmark worker.
- [ ] Crash/retry/restart/backup-restore and Redis outage demonstrations.
- [ ] AWS staging rehearsal, dashboards/alerts, rollback and measured cost validation.

This is the first Phase 3 implementation milestone, not Phase 3 completion. The database adapters are not yet connected to live gameplay; character inventory still resets on server restart. See [backend setup/status](docs/PHASE_03_BACKEND.md) and [benchmark report](docs/PHASE_03_BENCHMARK.md). AWS remains Singapore/GameLift/ECS/RDS/ElastiCache as specified below; nothing has been deployed or purchased.

---

## Locked Infrastructure Decision

### Primary cloud
**AWS** is the Phase 3 production cloud.

### Primary region
**Asia Pacific (Singapore) — `ap-southeast-1`**

Reasons:
- mature regional service availability,
- good Southeast Asia connectivity,
- straightforward placement of backend, database, cache, CDN and game hosting,
- suitable starting point before multi-region complexity is justified.

### Secondary game-server location
**Asia Pacific (Thailand) — `ap-southeast-7`** may be added later as a GameLift fleet location when latency measurements and player distribution justify it.

Do **not** deploy a multi-region database or duplicate the entire backend into Thailand during Phase 3.

### Realtime game hosting
Use **Amazon GameLift Servers** for authoritative realtime game server processes.

Preferred initial instance family:
- Linux,
- ARM64 where the game server build supports it,
- Graviton compute-optimized instances such as `c7g`, or a newer eligible generation after benchmarking.

Important cost property:
- Amazon GameLift Servers currently includes network bandwidth in and out of AWS at no additional charge for eligible generation-6-and-newer game-server instances.
- Validate the rule and current instance pricing in the AWS GameLift pricing calculator before production purchase/commitment.

### Application backend
Use **Amazon ECS** for the initial API/backend deployment.

Do **not** introduce EKS/Kubernetes in Phase 3 unless a concrete requirement cannot reasonably be handled by ECS/GameLift.

### Primary persistence
Use **Amazon RDS for PostgreSQL**.

### Realtime/transient state
Use **Amazon ElastiCache for Redis or Valkey**.

### Static content and downloads
Use:
- Amazon S3,
- Amazon CloudFront.

### Observability/security
Use the minimum necessary set of:
- CloudWatch,
- CloudTrail,
- IAM,
- Secrets Manager or Parameter Store,
- AWS WAF only where HTTP-facing services justify it.

Avoid adding services only because they are available.

---

## Architecture Philosophy

The main scaling unit is a **map/channel**, not an entire MMO world.

The player's experience should feel like one persistent MMORPG world while the infrastructure internally divides workload into independent channels/instances.

```text
Browser Client
     |
     | HTTPS / WebSocket / realtime protocol
     v
CloudFront + S3 -------------------- static assets
     |
     v
ALB / API entry
     |
     v
ECS Backend
+-----------------------+
| Auth / Account        |
| Character API         |
| World Manager         |
| Economy               |
| Social / Chat         |
| Match / Routing       |
+----------+------------+
           |
      +----+----------------+
      |                     |
      v                     v
ElastiCache             RDS PostgreSQL
Redis / Valkey          durable state
      |
      v
GameLift Fleet Manager
      |
      v
GameLift Servers
+----------------------------+
| Town Channel               |
| Adventure Channel          |
| Dungeon / Party Instance   |
| House Instance             |
| Raid Instance              |
+----------------------------+
```

Do not split every logical subsystem into a separate microservice until profiling, scaling, ownership boundaries or deployment requirements justify it.

---

## Initial Deployment Boundaries

Keep Phase 3 to approximately four major runtime categories.

### 1. `backend-service` — ECS
Initial logical modules may live in one deployable service or a very small number of services:
- authentication,
- character/profile API,
- world/channel manager,
- economy transaction coordinator,
- matchmaking/routing,
- social/chat coordination,
- telemetry/API endpoints.

### 2. `realtime-game-server` — GameLift
Runs authoritative simulation for:
- town channels,
- adventure channels,
- dungeons,
- private/party maps,
- houses,
- raid sessions.

### 3. PostgreSQL — RDS
Durable authoritative records.

### 4. Redis/Valkey — ElastiCache
Transient coordination and fast ephemeral state.

Do not begin Phase 3 with:
- dozens of microservices,
- Kafka unless a measured need exists,
- service mesh,
- EKS,
- multiple databases per domain,
- cross-region synchronous persistence.

---

## Persistence Responsibilities

### PostgreSQL stores
- account,
- character,
- character progression,
- inventory,
- equipped items,
- quest state,
- currencies,
- item ownership,
- crafting progression,
- housing metadata,
- guild membership,
- NPC ownership,
- persistent NPC relationship state,
- season state,
- durable moderation state,
- economy/audit ledger.

PostgreSQL is the authority for durable value.

### Redis / Valkey stores
Use for short-lived or rebuildable information such as:
- online presence,
- map/channel routing,
- matchmaking queues,
- reconnect/session routing,
- distributed short-lived locks,
- rate limits,
- transient party state where appropriate,
- temporary map coordination,
- pub/sub or lightweight event fan-out where appropriate.

Redis must **not** become the only source of truth for durable currency, inventory or premium value.

---

## World / Channel Types

Support at minimum:

### Town channel
Target design population:
- approximately **50–100 visible players per channel**.

Town behavior:
- low combat load,
- higher social/player density,
- chat/trade/party activity,
- many mostly idle entities.

### Adventure channel
Target design population:
- approximately **30–50 players per channel**.

Contains:
- enemies,
- combat,
- loot,
- world events,
- gathering,
- optional PvP depending on map rules.

### Dungeon / party instance
Target:
- approximately **1–8 players**, depending on content.

### House instance
Contains:
- owner,
- visitors,
- resident NPCs,
- housing objects.

### Raid instance
Contains:
- attacker(s),
- defender when online,
- authoritative copy/reference of valid housing layout,
- traps,
- guards,
- raid objectives and loot rules.

---

## World Manager Responsibilities

Implement a world/channel manager that can:
- create a channel,
- allocate players,
- enforce capacity limits,
- select the least-loaded suitable channel,
- create private instances,
- track population,
- register GameLift game sessions,
- route reconnects,
- retire idle channels,
- detect failed sessions,
- place replacement sessions,
- expose channel health and capacity metrics.

The client must never select arbitrary GameLift endpoints directly without an authorized server-side placement/routing flow.

---

## Server Authority

The realtime game server is authoritative for:
- position validation,
- movement constraints,
- combat outcomes,
- cooldowns,
- hit validation,
- enemy state,
- loot spawning,
- pickup eligibility,
- map transition eligibility,
- player death,
- interaction distance,
- raid state.

The browser sends **intent**, not trusted results.

Examples:

```text
Client: "move toward X,Y"
Server: validates movement and publishes authoritative position.

Client: "attack entity 102"
Server: validates range, cooldown, state and calculates outcome.

Client: "pick up item 887"
Server: validates ownership/availability and performs an idempotent inventory transaction.
```

Never trust browser-supplied:
- currency totals,
- inventory contents,
- damage amounts,
- final positions,
- reward results,
- gacha results,
- crafting outcomes,
- raid loot results.

---

## Simulation and Tick Strategy

Initial benchmark range:
- **10–15 authoritative simulation ticks/second** for ordinary world gameplay.

Do not hard-code this as the final value.

The agent must make tick rate configurable by environment and benchmark:
- 10 Hz,
- 15 Hz,
- optionally 20 Hz if combat quality requires it.

Separate simulation frequency from outbound replication frequency when useful.

Examples:
- nearby combat entities: higher update priority,
- distant players: reduced update frequency,
- idle town entities: much lower update frequency,
- static housing objects: event-driven replication rather than repeated position state.

---

## Interest Management / AOI

Full-map replication is prohibited.

Implement spatial Area of Interest (AOI).

Required behavior:
- divide map into cells/grid/spatial partitions,
- subscribe player to nearby cells,
- emit enter/leave interest events,
- replicate nearby relevant entities,
- reduce update frequency with distance/priority,
- avoid sending unchanged static state repeatedly.

Priority order should generally favor:
1. local player-critical state,
2. nearby combat actors,
3. nearby players,
4. interactable world objects,
5. distant/noncritical actors,
6. cosmetic/nonessential state.

AOI effectiveness must be measured in **bytes/player/sec**, not assumed.

---

## Network Protocol

Design the protocol so the transport can be profiled and changed without rewriting game logic.

Recommended baseline:
- binary realtime packets where useful,
- compact entity/state identifiers,
- delta/state-change messages instead of full snapshots whenever practical,
- sequence numbers/timestamps,
- client interpolation,
- reconciliation only where gameplay requires it,
- compression only after measuring CPU vs bandwidth tradeoffs.

JSON is acceptable for ordinary HTTP APIs and early debug tooling but should not be assumed to be the final high-frequency world-state format.

---

## Session / Reconnect

Required:
- account access token,
- game session token,
- one active character-session rule,
- reconnect grace period,
- duplicate connection handling,
- last valid authoritative state,
- crash-safe durable checkpoints,
- safe fallback position when the previous map session cannot be recovered.

Reconnect flow should attempt:

```text
Existing session alive?
    | yes
    v
Resume same map/session

    | no
    v
Recover from latest durable/checkpoint state
    |
    v
Place player into safe replacement channel/state
```

The agent must not invent item duplication-prone reconnect logic.

---

## Economy / Inventory Transactions

All durable value operations must be transactional and idempotent.

Every relevant operation should carry a unique operation/idempotency ID.

Examples:
- pickup,
- quest reward,
- purchase,
- sale,
- crafting,
- player trade,
- raid loot,
- premium grant,
- mail attachment claim,
- compensation grant.

Create appendable/auditable ledger events for currency and premium-value changes.

A repeated request with the same operation ID must not duplicate value.

---

## Chat Baseline

Support initially:
- nearby,
- town,
- party,
- whisper,
- system.

Add:
- per-channel rate limits,
- mute,
- block,
- server-side moderation hooks,
- abuse logging,
- message length limits.

Voice belongs primarily to Phase 7 and should not block Phase 3 architecture.

---

## Anti-Cheat Baseline

Server validations must include at minimum:
- impossible movement speed,
- teleport-distance anomalies,
- impossible attack frequency,
- invalid cooldown use,
- invalid casts,
- invalid target/range,
- fake item pickups,
- duplicated operation IDs,
- invalid currency changes,
- impossible map transitions,
- malformed packet/rate abuse.

Create security-event logs that can later feed automated actions.

Do not put core cheat detection only in browser JavaScript.

---

# AWS Capacity and Cost Planning

## Important rule
All capacity numbers below are **planning targets**, not promises.

Before production sizing, replace estimates with measured results from the game's actual server binary.

---

## Initial Game Server Capacity Target

Use a **4-vCPU / 8-GB-class compute worker** as the primary benchmark shape.

Example candidate:
- Graviton `c7g.xlarge` or a newer GameLift-supported generation with equivalent/better economics.

Planning target:
- **120–180 concurrent players per 4-vCPU worker**, depending on map mix.
- Use **150 CCU per worker** as the financial planning midpoint until benchmarking replaces it.

This is total concurrent population across multiple server processes/channels on one host where supported, not necessarily one map with 150 players.

Illustrative packing only:

```text
4-vCPU worker

Town channel       45 players
Forest channel A   30 players
Forest channel B   30 players
Dungeons/houses    20 players
Reserve/background 25-player-equivalent capacity

Approximate target: 125–150 CCU
```

Do not design game rules around this estimate.

---

## Required Load-Test Ladder

The Phase 3 load harness must test at least:

```text
50 synthetic clients
100 synthetic clients
150 synthetic clients
200 synthetic clients
```

on a 4-vCPU benchmark worker or closest equivalent.

At every step record:
- average CPU,
- p95 CPU if meaningful,
- memory,
- server tick duration average,
- server tick duration p95/p99,
- outbound bytes/player/sec,
- inbound bytes/player/sec,
- packets/player/sec,
- AOI entity count/player,
- event loop/scheduler delay,
- database operations/sec,
- Redis operations/sec,
- disconnect rate,
- reconnect success rate,
- combat action latency,
- GC pauses where applicable.

Stop increasing load once tick/SLO quality is violated.

The resulting measured **safe CCU per instance** becomes the source of truth for infrastructure planning.

---

## Performance SLO Targets for Benchmarking

Initial engineering targets; adjust only with recorded evidence.

### Realtime server
- maintain configured tick rate under expected load,
- no sustained tick backlog,
- p95 simulation tick comfortably below the tick budget,
- no memory growth indicating leaks during long soak tests.

### Player experience
- map join succeeds reliably,
- reconnect succeeds after temporary disconnect,
- nearby actions remain responsive under load,
- world replication does not require full-map state broadcasts.

### Persistence
- duplicate transaction attempts do not duplicate value,
- game-server crash does not create duplicated inventory/currency,
- durable character state survives service restart.

---

# Cost Model

## Metrics to track
Do not use only monthly cloud spend.

Track:
- cost / player-hour,
- cost / average CCU-month,
- cost / MAU,
- cost / paying user,
- infrastructure cost / revenue,
- GameLift compute cost / player-hour,
- DB/cache/backend fixed cost,
- observability/logging cost.

### Definition: average CCU-month
One average CCU represents roughly one continuously occupied concurrent slot over the month.

### Definition: player-hour
One player online for one hour.

This is usually the most useful realtime infrastructure unit.

---

## Planning Assumptions

Use these only until real measurements exist:

| Variable | Planning assumption |
|---|---:|
| Average CCU as % of peak | 30% |
| Authoritative simulation | 10–15 Hz |
| Town population | 50–100/channel |
| Adventure population | 30–50/channel |
| 4-vCPU worker capacity | 150 average planning CCU |
| Spare compute/capacity buffer | 20–25% |
| Example state traffic | ~10 KB/sec/player |
| OS | Linux |
| CPU architecture | ARM64 preferred |
| Initial fleet mix | mostly On-Demand |

Do not include AI inference or Phase 7 voice/SFU cost inside Phase 3 game-server cost unless explicitly modeling them.

---

## Budget Planning Ranges

These numbers are engineering budget ranges only and must be recalculated with the AWS calculator and measured CCU/instance before launch.

### Closed beta
- peak CCU: ~500,
- average CCU: ~150,
- planning budget: **~USD 600–1,000/month**.

Indicative:
- ~USD 4.0–6.7 / average CCU-month,
- ~USD 0.0055–0.009 / player-hour equivalent.

At this size fixed DB/cache/backend costs dominate.

### Early launch
- peak CCU: ~2,000,
- average CCU: ~600,
- planning budget: **~USD 1,300–2,200/month**.

Indicative:
- ~USD 2.2–3.7 / average CCU-month,
- ~USD 0.0030–0.0050 / player-hour equivalent.

### Growth
- peak CCU: ~10,000,
- average CCU: ~3,000,
- planning budget: **~USD 4,000–7,000/month**.

Indicative:
- ~USD 1.3–2.3 / average CCU-month,
- ~USD 0.0018–0.0032 / player-hour equivalent.

### Large scale
- peak CCU: ~50,000,
- average CCU: ~15,000,
- planning budget: **~USD 17,000–30,000/month**.

Indicative:
- ~USD 1.1–2.0 / average CCU-month,
- ~USD 0.0015–0.0027 / player-hour equivalent.

At large scale, retail list pricing should not be treated as final; evaluate commercial discounts/commitments and actual fleet utilization.

---

## GameLift Cost Optimization Strategy

### Phase 3 / beta
Start conservatively:

```text
70–80% On-Demand capacity
20–30% Spot/interruptible overflow
```

Only use Spot where losing/replacing a host is safe.

Good early Spot candidates:
- temporary dungeons,
- disposable adventure channels with reconnect recovery,
- overflow channels.

Avoid relying heavily on Spot for:
- primary town capacity,
- critical persistent sessions,
- any session without tested recovery.

### After recovery/migration is proven
Potential direction:

```text
50–70% On-Demand
30–50% Spot
```

The exact mix must come from interruption rate, player impact, current Spot savings and operational metrics.

AWS states GameLift Spot can provide material savings versus On-Demand, but the agent must never assume a fixed discount in financial code/configuration.

---

## Autoscaling

Scale on useful capacity metrics rather than CPU alone.

Consider:
- available player slots,
- active sessions,
- queued placement requests,
- channel utilization,
- CPU/tick saturation,
- predicted near-term demand.

Maintain a warm capacity buffer sufficient to avoid login/map-placement spikes waiting for new servers.

Record:
- requested capacity,
- active capacity,
- idle capacity,
- players/instance,
- placement latency,
- scale-out latency.

---

## Region Expansion Rules

Do **not** create additional production regions simply for architectural elegance.

Add a Thailand GameLift location when measurements show a meaningful player-experience or cost benefit.

Before expansion, measure:
- player geography,
- Singapore RTT distribution,
- combat sensitivity to RTT,
- Thailand GameLift pricing,
- expected fleet utilization,
- operational complexity.

Initial regional model:

```text
Singapore
  Backend
  PostgreSQL
  Redis/Valkey
  Primary GameLift capacity

Later, if justified:
Thailand
  GameLift game-server capacity only
  |
  +---- secure communication to Singapore control/persistence plane
```

Do not perform synchronous database writes to a distant region on every simulation tick.

---

# Headless Load Simulation

Create a repeatable load-test client capable of:
- login/session establishment,
- joining a town,
- idling,
- random movement,
- clustered movement,
- chatting,
- combat actions,
- enemy interaction,
- item pickup,
- map transfer,
- disconnect/reconnect,
- party-instance creation,
- logout.

Scenarios should include at least:

### Scenario A — dense town
Many nearby mostly-idle players with chat/social activity.

### Scenario B — adventure combat
Lower player density plus enemies, combat and loot.

### Scenario C — event hotspot
Many players converge into one AOI around an event/boss.

### Scenario D — reconnect storm
A large percentage disconnect and reconnect within a short interval.

### Scenario E — map transition surge
Many clients move between maps around the same time.

### Scenario F — long soak
Hours-long simulation to detect leaks, gradual lag and persistence issues.

---

# Infrastructure as Code

All repeatable AWS infrastructure must be declared as code.

Choose one primary IaC tool and use it consistently:
- Terraform/OpenTofu, or
- AWS CDK.

The agent should not create production-critical resources only by clicking in the AWS Console.

Environment separation:

```text
dev
staging
production
```

Avoid cloning oversized production infrastructure into dev.

---

# Security Requirements

Use:
- private networking for PostgreSQL and Redis,
- security groups with minimum required connectivity,
- IAM roles instead of embedded credentials,
- Secrets Manager/Parameter Store for secrets,
- TLS for external traffic,
- authorization checks for every economy/admin operation,
- audit logs for infrastructure/control-plane actions.

Game server instances must not receive broad administrator AWS permissions.

---

# Observability

Create dashboards/alerts for:

### Game servers
- active instances,
- active processes,
- active channels,
- CCU,
- CCU/instance,
- tick duration,
- CPU,
- memory,
- bytes/player/sec,
- packet rates,
- disconnects,
- session placement latency.

### Backend
- API latency,
- error rate,
- auth failures,
- channel-placement failures,
- chat rate-limit events,
- economy transaction failures.

### PostgreSQL
- CPU,
- connections,
- query latency,
- slow queries,
- locks,
- storage,
- replication/HA health when enabled.

### Redis/Valkey
- memory,
- ops/sec,
- connections,
- evictions,
- latency,
- failover state when enabled.

### Cost
Tag resources by:
- environment,
- service,
- game-server fleet,
- region.

Create cost budgets/alerts before public launch.

---

# Implementation Order

## Step 1 — local authoritative server boundary
- isolate simulation from browser,
- define server intent protocol,
- establish authoritative movement/combat.

## Step 2 — persistent identity
- authentication,
- account/character persistence,
- PostgreSQL schema/migrations.

## Step 3 — Redis/Valkey coordination
- presence,
- channel registry,
- transient routing,
- rate limits.

## Step 4 — channel manager
- town/adventure/private instance lifecycle,
- capacity limits,
- reconnect routing.

## Step 5 — GameLift integration
- server build packaging,
- process lifecycle,
- fleet/session placement,
- health checks,
- autoscaling baseline.

## Step 6 — AOI/network optimization
- spatial subscriptions,
- delta updates,
- priority replication,
- metrics.

## Step 7 — durable transaction safety
- idempotency,
- inventory/economy ledger,
- crash/retry testing.

## Step 8 — load harness
- synthetic clients,
- test ladder,
- hotspot and reconnect scenarios.

## Step 9 — cost benchmark
Using measured safe CCU/worker:
- calculate compute/player-hour,
- estimate fleet count at 500 / 2k / 10k / 50k peak CCU,
- validate GameLift pricing,
- update this document's budget assumptions.

## Step 10 — staging production rehearsal
- failure testing,
- fleet replacement,
- database backup/restore,
- Redis failure behavior,
- deployment rollback.

---

# Phase 3 Acceptance Criteria

Phase 3 is complete only when all of the following are demonstrated.

## Multiplayer
- at least 50 synthetic clients can occupy one town channel in the development/staging test,
- target load ladder has been executed,
- channel allocation and retirement work correctly,
- map transfer works,
- private instances work.

## Performance
- configured tick target is maintained at the selected safe CCU,
- AOI materially lowers network volume versus naive full-map replication,
- safe measured CCU/instance is documented,
- bytes/player/sec is documented,
- hotspot/event load behavior is documented.

## Persistence
- inventory survives restart,
- character progression survives restart,
- duplicate economy requests cannot duplicate value,
- game server failure does not create duplicated durable value.

## Reconnect
- temporary network loss reconnects safely,
- failed/dead map sessions recover to a defined safe state,
- duplicate simultaneous character sessions are handled.

## Infrastructure
- GameLift fleet can deploy a server build,
- GameLift placement can start/join a session,
- ECS backend deploys from CI/CD,
- RDS and Redis are private,
- staging infrastructure is reproducible with IaC.

## Operations
- core dashboards exist,
- critical alerts exist,
- cost tags/budgets exist,
- rollback procedure exists.

## Cost validation
- measured cost/player-hour estimate exists,
- measured cost/average-CCU-month estimate exists,
- estimates for 500, 2k, 10k and 50k peak CCU are updated from real benchmark results,
- GameLift current pricing and network-bandwidth terms have been revalidated before production launch.

---

# Phase 3 Exit Deliverables

The implementation agent must leave behind:

1. realtime server source,
2. backend source,
3. database migrations,
4. Redis key/data model documentation,
5. realtime protocol documentation,
6. channel lifecycle documentation,
7. reconnect sequence documentation,
8. GameLift build/deployment configuration,
9. ECS deployment configuration,
10. IaC for dev/staging baseline,
11. synthetic load-test tool,
12. benchmark report,
13. cost model spreadsheet/markdown output,
14. runbook for deploy/rollback,
15. failure/recovery test report.

---

# Decisions Still Open During Phase 3

These must be resolved through testing rather than guessed:

- final authoritative tick rate,
- final packet/serialization format,
- safe CCU per GameLift instance,
- number of server processes per host,
- PostgreSQL initial HA configuration for production,
- Redis/Valkey topology for production,
- durable checkpoint interval,
- exact reconnect grace period,
- exact town channel cap,
- exact adventure channel cap,
- final On-Demand/Spot ratio,
- point at which Thailand GameLift capacity is enabled.

Document each final decision and evidence in `ARCHITECTURE_DECISIONS.md`.

---

# Agent Guardrails

The implementation agent must **not**:
- replace AWS/GameLift with another cloud without an explicit architecture decision,
- introduce Kubernetes by default,
- treat Redis as authoritative durable storage,
- trust browser game-state outcomes,
- broadcast full map state to every client,
- design around estimated 150 CCU/worker as if it were proven,
- use Spot for critical capacity without tested interruption recovery,
- add multi-region database complexity during Phase 3 without measured need,
- allow local/on-prem AI to mutate authoritative inventory/economy/game state.

When uncertain, optimize first for:
1. gameplay correctness,
2. server authority,
3. recoverability,
4. measurable performance,
5. simplicity,
6. cost efficiency.

---

# Pricing / Platform References

Validate again at implementation time because cloud products and pricing change.

- Amazon GameLift Servers pricing and cost planning: https://docs.aws.amazon.com/gameliftservers/latest/developerguide/gamelift-intro-pricing.html
- Amazon GameLift Servers pricing calculator guidance: https://docs.aws.amazon.com/gameliftservers/latest/developerguide/gamelift-calculator.html
- Amazon GameLift Servers FAQ / bandwidth rules: https://aws.amazon.com/gamelift/servers/faqs/
- AWS announcement — free GameLift network bandwidth for eligible generation 6+ instances (June 15, 2026): https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-gamelift-servers-free-network-bandwidth/
- GameLift Thailand support / release notes: https://docs.aws.amazon.com/gameliftservers/latest/developerguide/release-notes.html

Last architecture/pricing review for this plan: **2026-09-29**.
