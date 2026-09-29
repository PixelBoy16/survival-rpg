# Phase 3 first milestone

The running game now uses cell-based spatial interest, hides other players' progression/inventory, throttles distant changes and suppresses unchanged records. `SIMULATION_HZ` selects 10, 15 or 20; default remains 20 pending combat-feel evidence. The logical clock stays in 50 ms units so protocol cooldowns and content durations retain their meanings at every rate. Movement and stamina regeneration scale with elapsed simulation time.

PostgreSQL and Redis adapters are written but **not connected to gameplay yet**. The live server still uses anonymous ephemeral sessions. Do not claim restart-safe characters or durable item grants from this milestone. The next implementation step is account/session APIs plus a serialized durable-command boundary that commits value before acknowledging rewards, with failure/retry tests before enabling it.

## Local services

For a real AWS Redis service reached from this PC, see [AWS Redis development setup](AWS_REDIS_DEV.md). It includes Terraform, an SSM tunnel and authenticated TLS integration testing. Deployment and the first live test still require an authenticated AWS profile.

Requires Docker Compose (not found on this host during this run), or existing disposable PostgreSQL 16 and Redis/Valkey services.

1. Copy `.env.example` to `.env`, replace the local development password in both password and URL fields.
2. `docker compose --env-file .env -f infra/compose.yml up -d` starts loopback-only PostgreSQL/Redis.
3. Export `DATABASE_URL` and `REDIS_URL` in the shell before using the adapters. The current scripts do not auto-load `.env`.
4. Run `pnpm db:migrate`. Migrations run under a PostgreSQL advisory lock, each in a transaction, and store checksums. Applied migrations must not be edited.
5. Set `TEST_DATABASE_URL` and `TEST_REDIS_URL` to disposable test services, then `pnpm check`. Without these explicit test variables the two external-service tests are reported as skipped, not passing.

The PostgreSQL test creates/drops a randomly named isolated test schema. Redis tests use randomly named exact keys. CI declares ephemeral service containers and enables both tests, but a successful CI execution has not yet been observed. Compose Redis is disposable coordination state; PostgreSQL has a named volume. Avoid deleting that volume when stopping development services.

## Durable data contract

Migration 001 defines accounts, characters, one authoritative versioned JSONB character checkpoint, operation deduplication and an append-only value ledger. A snapshot currently uses a backend-only JSON object boundary; a fully validated gameplay snapshot codec must be connected before exposing persistence to the runtime. Future normalized inventory tables must migrate authority, not introduce a second independent source of item truth.

`CharacterRepository.commit` checks character ownership, locks the character/checkpoint, rejects stale session epochs and revisions, detects operation-ID reuse with a different payload, and writes the checkpoint, operation result and before/after ledger in one transaction. A matching retry returns the recorded result. `acquireEpoch` fences previous writers. Callers must hold a Redis lease and stop accepting value mutations if lease renewal or PostgreSQL commit fails. The current game loop does not call these methods yet.

Production application credentials should have only necessary grants. The ledger trigger rejects UPDATE/DELETE; DB administrators retain expected administrative power. Account auth, password hashing, access/game tokens, lease orchestration and durable death/quest/event semantics are still pending. Do not treat the adapters alone as a production economy.

## Redis key model

| Key | TTL | Purpose |
|---|---:|---|
| `haven:v1:lease:<character>` | 30 s | Random owner token, NX acquisition, compare-token renewal/release |
| `haven:v1:presence:<character>` | 45 s | Rebuildable channel locator |
| `haven:v1:rate:<subject>` | configured fixed window | Atomic counter with expiry |

Values contain no inventory, currency or premium authority. Redis failures reject adapter operations; there is no in-memory fallback pretending to be a distributed lock. Channel registry/routing/private-instance allocation and recovery are the next coordination work.

## AWS boundaries and costs

Keep the plan's Singapore control plane, GameLift realtime capacity, ECS backend, RDS PostgreSQL, ElastiCache Redis/Valkey and S3/CloudFront assets. No resources were created. ARM64 packaging and the actual GameLift SDK integration still need validation. Do not deploy these adapters directly as a complete backend.

AWS currently documents free network bandwidth for generation-6-and-later GameLift instance types: [official pricing guide](https://docs.aws.amazon.com/gameliftservers/latest/developerguide/gamelift-intro-pricing.html). This does not establish an instance price, supported regional shape, safe CCU or total cloud budget. Revalidate the selected fleet and current calculator pricing before purchase. Local benchmark results cannot be substituted for GameLift worker measurements.

Cost worksheet inputs remain pending: measured safe CCU per worker, hourly fleet price, utilization, spare-capacity factor, RDS/cache/backend/logging fixed costs and peak-to-average ratio. Once measured, compute `worker player-hour cost = hourly worker price / (safe CCU * utilization)`, add fixed-service allocations, and model 500/2k/10k/50k peak CCU. Existing plan budgets are estimates only.
