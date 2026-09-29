# ADR-002: Desktop control choice and mobile touch controls

Accepted at the owner's request. Supersedes ADR-001's deferral of click-to-move. Desktop browser remains the primary platform.

Desktop has a saved Movement setting: WASD/arrows (default) or click-to-walk. Click on ground sets a destination; selecting an entity does not set a destination. Escape, mode changes, window blur, resize, death and disconnect cancel walking. Action keys remain available in either desktop mode.

Devices whose primary pointer is coarse use only an analog joystick for movement and buttons for attack, both weapons, heal, collect, respawn and zoom. Keyboard gameplay and ground-click walking are disabled in this layout. Pointer capture tracks a single joystick finger; other fingers can press action buttons independently. Release, cancel and lost capture stop joystick motion. The layout adapts to portrait/landscape and safe-area insets. Desktop preferences remain saved when touch layout is active.

An additive v1 `navigate` intent sends a finite map destination, never a position update. The server validates the endpoint and plans a bounded four-neighbor route around static walls. Segments respect the player collision radius; movement follows the path at the existing fixed-tick speed, clamping the last step to avoid overshoot. The client refreshes the same destination at 20 Hz; the server reuses its path. Stale navigation expires after six ticks just like direct movement. Direct movement cancels a path. No persistence schema changes are needed; the desktop preference is a local UI value, not authoritative state.

Automated coverage includes camera coordinate inversion, analog clamping/dead zone, second-finger isolation, route collision/speed, arrival, rejected endpoints, stale input, cancellation and replay protection. Browser and physical-device playtesting remain pending due to the previously denied browser access. Local servers still bind loopback; this change does not expose the project to a network.
