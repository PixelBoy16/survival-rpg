# Phase 7 — Social, Guilds and Voice

## Objective
Make the world socially sticky enough to reproduce the town culture of classic MMORPGs.

## Friends and presence
Implement:
- friend request,
- accept/decline,
- block,
- online status,
- privacy-aware activity visibility.

## Party
Implement:
- invite/accept,
- leader,
- kick/leave,
- ready state,
- party markers,
- shared text/voice,
- party finder.

## Guilds
Implement:
- create guild,
- roles,
- permissions,
- member list,
- guild chat,
- announcements,
- guild progression placeholder,
- guild activity log.

Later extensions:
- guild house,
- territory,
- guild raids.

## Text chat
Channels:
- world,
- town,
- nearby,
- party,
- guild,
- whisper,
- trade,
- system.

Requirements:
- spam limits,
- mute,
- block,
- report,
- moderation events,
- retention policy.

## Voice
Use WebRTC + SFU.

Channels:
- proximity,
- party,
- guild,
- radio.

Proximity voice:
- full volume near player,
- distance falloff,
- muted beyond range.

Game server determines subscription eligibility; SFU handles media routing.

## Voice UX
Add:
- push-to-talk,
- voice activity,
- per-user volume,
- mute,
- block,
- input/output selection,
- mic test,
- network quality indicator.

## Moderation
Required:
- text report,
- voice report metadata,
- mute/block,
- moderation audit trail,
- rate-abuse detection.

Do not store raw voice by default unless a clear privacy/moderation policy authorizes it.

## Acceptance criteria
- Players can meet, talk, form a party and travel together.
- Proximity voice membership updates with distance.
- Blocking removes text/voice exposure.
- Guild permissions work.
- Party finder can form a group.

## Tests
- party permission tests,
- guild role tests,
- block/mute tests,
- proximity membership tests,
- voice signaling reconnect tests,
- chat rate-limit tests.

## Decisions
- SFU provider or self-hosting,
- voice retention policy,
- world chat scale,
- guild size,
- party finder roles,
- whether radio is a gameplay item.
