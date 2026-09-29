# Phase 1 manual acceptance

1. Run `pnpm install`, then `pnpm dev`. On the supplied Windows machine, `powershell -File scripts/dev.ps1` also finds the bundled Node runtime after dependencies have been installed.
2. Open `http://127.0.0.1:5173` in two independently opened tabs (do not duplicate a tab with copied session storage). Confirm two survivor labels appear and movement replicates.
3. WASD/arrows move relative to the screen. Walk against map boundaries and concrete walls; confirm no penetration. Scroll changes zoom; F3 shows server positions and collision geometry.
4. E at arrival collects one of three shared cache bandages. A fourth attempt fails. The HUD must show server-confirmed inventory only.
5. Approach infected; click selects, Space attacks the selected infected (or nearest when none is selected). 1/2 switch weapons. Repeated attacks cannot bypass recovery; move beyond melee range and attacks fail. Kill both infected types and use E to collect salvage.
6. In the other client, attempt to collect a fresh drop from the first player's kill. It remains reserved for 10 seconds. A drop is collectible only once. Infected return after 15 seconds.
7. Take damage, use 3 to heal, check one bandage is consumed. On death, R returns to arrival after a three-second delay. Temporary inventory is retained in this isolated foundation test.
8. Set 150 and 300 ms simulated RTT. Confirm measured RTT approximately reflects selection plus real transport delay. Check input remains bounded even during delayed packets.
9. Click Test reconnect; same player, inventory and sequence must return. A server restart instead creates a fresh session. Reconnect after more than 30 seconds gives a new character.
10. Play for ten minutes at the intended desktop resolution on an integrated-GPU laptop. Record average/min FPS, frame time, RTT, entities and KB/s. Check repeated death, respawn, reconnect, resize, zoom and focus loss. Browser console should have no unhandled errors. Confirm focus loss stops movement.

Do not mark the phase exit gate complete until the two-browser visual and ten-minute responsiveness/performance checks are recorded. Automated WebSocket tests support but do not replace these checks.

## Control customization checks

- Desktop: switch Movement to Click to walk; click beyond a concrete wall and confirm the character routes around it and stops at the marker. Click walls/outside the map to verify rejection. WASD must not move in click mode. Switch back while walking and confirm immediate cancellation; reload to check the saved choice.
- Click an entity to select without starting a new route. Test Escape, focus loss, resizing and reconnect cancellation. Check zoomed/translated clicks land at the intended world location.
- Emulate a coarse primary pointer or use a deployed mobile build: the mode selector and keyboard hints disappear. Joystick is the only movement source; tapping ground must not walk. Drag at half/full radius, release outside the joystick, cancel touch, rotate or background the page; movement must stop reliably.
- Hold the joystick with one finger and press Attack/weapon/heal/collect with another. The second finger must not move or release the joystick. Check all buttons, respawn and zoom at 360×800 portrait and 800×360 landscape, including safe areas.
