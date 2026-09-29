# ADR-001: Foundation simulation and rendering

## Status
Accepted for the Phase 1 implementation, 2026-09-29. No owner-gated product decision is changed.

## Context
The repository began with product documents only. The vertical slice needs responsive browser rendering, authoritative multiplayer rules and repeatable tests without early infrastructure overhead.

## Decision
- Choose PixiJS 8 over Phaser. Use its WebGL renderer and scene graph, with a small explicit simulation boundary; Phaser's integrated client physics would not provide server authority. Renderer API reference: [PixiJS Application](https://pixijs.com/8.x/guides/components/application).
- Use TypeScript, Node.js 22+, `ws`, Zod, Vite and the Node test runner. Keep the package graph in one root install until independent publishing is needed.
- One world unit is one tile; positive X/Y are map axes. Render with `(x-y)*32, (x+y)*16` for 64×32 diamonds. Player collision radius is 0.28 tiles. All server distances remain in world units.
- Run authoritative fixed steps at 20 Hz. Keyboard direction intent is normalized, independent of render FPS, and expires in six ticks. Collision is axis-separated against map rectangles/bounds. No client time controls displacement.
- Use a fixed isometric camera with follow and 0.7–2× zoom. Screen-relative keyboard directions convert to world axes before submission.
- Use idle/walk/attack/hurt/dead animation states selected by server behavior. Four generated placeholder frames per state/kind share reusable textures. Authored sprite sheets can replace these frames without changing game rules; no external art assets are required.
- Smooth rendered server positions over approximately 55 ms, without client prediction. Re-evaluate input-sequence-based prediction and reconciliation after the latency playtest. Never blend client position back into authoritative state.
- Original decision: defer click-to-move until navigation exists. Superseded by [ADR-002](ADR-002-controls.md): owner-requested desktop click-to-walk now uses server-side routing; mobile uses joystick/action buttons.
- Use temporary random bearer sessions and in-memory state for the local test. PostgreSQL/Redis adoption remains Phase 3; protocol/content versioning starts now.

## Consequences
The slice is easy to run and its rules can be tested without a browser. Noticeable latency is expected at 150–300 ms RTT because movement has no prediction. Prototype visuals need authored art and target-hardware playtesting. We avoid shipping fake persistence and keep backend authority independent from rendering choices.

## Alternatives considered
Phaser for more built-in animation/scene tools; raw Canvas2D for fewer dependencies; Colyseus for multiplayer state management; client prediction immediately. None are ruled out for future ADRs, but the explicit minimal stack fits this phase.

## Owner
Project LAST HAVEN engineering; product policy remains governed by AGENTS.md and the decision register.
