# Phase 3 initial local measurements

Recorded 2026-09-29. These are development measurements, not AWS capacity or production acceptance results.

## Dense town WebSocket workload

`pnpm load:local`: 50 clients, 20% sending movement every 100 ms, ten seconds of play, then all disconnect and resume. The server and driver share one Windows process. All three runs resumed the same 50 characters, with zero rejected requests.

| Simulation Hz | Outbound bytes/player/s | Packets/player/s | Combined process CPU | RSS MiB | Maximum server update ms |
|---|---:|---:|---:|---:|---:|
| 10 | 26,642 | 11.03 | 13.08% | 111.4 | 8.64 |
| 15 | 38,706 | 15.96 | 12.77% | 97.2 | 7.88 |
| 20 | 50,445 | 20.79 | 15.09% | 97.2 | 8.19 |

Payload includes welcome/reconnect records and JSON messages, excludes transport framing and infrastructure overhead. CPU uses process CPU time divided by wall time; it is not whole-machine utilization. These short sequential runs do not establish a preferred production tick rate. Default remains 20 Hz.

## Spatial replication comparison

`pnpm benchmark:aoi` compares 50 dispersed town players over 400 logical ticks, using identical public projections and deterministic entity changes.

- Spatial replication: 53,530 bytes/player/s.
- Full-map changed records: 187,925 bytes/player/s.
- Payload reduction: 71.5%.
- Mean visible entities: 23.98 per client.

This synthetic comparison exercises replication rather than real combat or an internet connection. Dense players within the same radius naturally receive less benefit.

## Remaining acceptance work

- PostgreSQL and Redis integration execution on disposable services.
- Account authentication and durable gameplay integration before persistence/restart claims.
- Channel allocation before the 150/200-client ladder; the current process caps sessions at 100.
- Separate load generator and specified 4-vCPU server, p50/p95/p99 timing, long soak, impaired network, combat and crowded event scenarios.
- GameLift lifecycle, crash/restart durability and staging rehearsal.
- Browser frame-time/mobile checks, Thailand latency measurement and measured AWS cost inputs.

Do not extrapolate these results into safe CCU, monthly hosting cost or a completed Phase 3 gate.
