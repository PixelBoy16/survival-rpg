# Project LAST HAVEN — Architecture and Product Decision Register

| ID | Decision | Current baseline | Status |
|---|---|---|---|
| D-001 | Platform | Desktop browser first | Confirmed baseline |
| D-002 | Rendering | Isometric 2D/2.5D | Confirmed baseline |
| D-003 | World model | Shared towns + channelized maps | Confirmed baseline |
| D-004 | Authority | Server authoritative | Confirmed |
| D-005 | AI authority | AI cannot mutate authoritative game state | Confirmed |
| D-006 | Housing | Free-form sandbox | Confirmed |
| D-007 | Party | 4 combat slots | Baseline |
| D-008 | NPC party use | NPC consumes a slot initially | Baseline |
| D-009 | Survival | Moderate, not micromanagement-heavy | Baseline |
| D-010 | Death | Carried inventory + equipped gear lost; premium items survive; one protection item preserves other items for one death; bank/XP/level safe | Owner approved, ADR-003 |
| D-011 | Raid | Protected/limited-loss | Baseline |
| D-012 | NPC acquisition | Hybrid world + premium | Baseline |
| D-013 | Monetization | No direct competitive PvP power | Baseline |
| D-014 | Season | Soft reset | Baseline |
| D-015 | Voice | WebRTC + SFU | Baseline |
| D-016 | Persistence | PostgreSQL durable + Redis ephemeral | Baseline |

## ADR template

Implementation ADR: [ADR-001 — Foundation simulation and rendering](docs/adr/ADR-001-foundation.md), accepted for Phase 1. Records renderer, world units, tick rate, movement, animation, interpolation and click-to-move timing. Product baselines above are unchanged.

Control update: [ADR-002 — Desktop and mobile controls](docs/adr/ADR-002-controls.md), owner requested. Adds desktop click-to-walk and mobile joystick/actions; supersedes click-to-move deferral.

Gameplay update: [ADR-003 — Phase 2 gameplay and recovery](docs/adr/ADR-003-gameplay.md). Includes the owner's explicit death-loss/protection decision, four-slot parties, PvE targeting and version boundaries.

```md
# ADR-XXX: Title

## Status
Proposed / Accepted / Superseded

## Context

## Decision

## Consequences

## Alternatives considered

## Owner
```
