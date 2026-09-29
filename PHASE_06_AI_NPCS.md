# Phase 6 — AI Survivors and Local AI Integration

## Objective
Create recruitable survivors that feel individual and persistent while keeping game rules safe, deterministic and low-latency.

## NPC domain model
Persistent fields:
- npc_instance_id,
- archetype_id,
- owner/group,
- name,
- job,
- traits,
- loyalty,
- trust,
- fear,
- mood,
- relationship edges,
- combat profile,
- housing assignment,
- memory summary,
- availability state.

## Personality
Represent core traits numerically, e.g.:
- aggression,
- bravery,
- empathy,
- greed,
- curiosity,
- loyalty,
- self-preservation.

Traits influence context and preferences but must not bypass game balance.

## Memory
Memory classes:
- episodic event,
- relationship event,
- important location,
- promise,
- loss,
- betrayal/help,
- preference.

Pipeline:
1. game event emitted,
2. importance scorer,
3. persist significant memory,
4. summarize older memory,
5. retrieve relevant context for dialogue/intent.

Use PostgreSQL + vector extension or a separate vector store only if justified.

## AI orchestration
Flow:
**game event → AI orchestrator → context builder → on-prem model → structured response → validator → game/NPC controller**

Response schema should contain bounded fields such as:
- dialogue,
- emotion,
- intent,
- target reference,
- confidence,
- memory candidates.

Never allow arbitrary model tool execution.

## Latency tiers
### Realtime combat
No LLM required.

### Tactical update
Deterministic behavior tree/state machine.

### Personality/dialogue
AI request with timeout/fallback.

If AI is unavailable, NPCs must still move, fight, heal, work and speak fallback dialogue.

## Combat behavior
Use deterministic profiles:
- medic,
- defender,
- scout,
- assault,
- scavenger.

Inputs:
- health,
- ammo,
- nearby enemies,
- party health,
- threat,
- cover,
- distance.

LLM may alter preference weights, never legality of combat actions.

## Dialogue context
Provide:
- current location,
- recent events,
- player reputation,
- relevant memories,
- relationship,
- current objective,
- personality.

Enforce response length, cooldown and spam controls.

## Voice AI
Optional pipeline:
- microphone,
- STT,
- AI dialogue,
- text response,
- optional TTS.

## NPC acquisition
Hybrid sources:
- world rescue,
- quest,
- reputation,
- tavern/recruit,
- rare event,
- premium contract.

World-acquired NPCs must remain meaningful.

## Acceptance criteria
- NPC remembers a significant event across sessions.
- Different traits produce noticeably different dialogue/intent.
- AI outage does not break gameplay.
- Model cannot create/grant items.
- Invalid structured actions are rejected.
- Combat remains deterministic and performant.

## Decisions
- on-prem model/runtime,
- vector store,
- context/token budget,
- memory retention,
- NPC death permanence,
- relationship depth,
- TTS/STT stack.
