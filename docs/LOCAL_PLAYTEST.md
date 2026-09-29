# Local Redis and internet playtests

This PC hosts the game and real Redis. Friends visit an HTTPS Cloudflare Quick Tunnel URL and enter an invite code. Only the built client and a gated WebSocket connection are exposed; Vite, Redis and the backend listener stay on loopback. No router port forwarding or AWS account is needed.

## This machine

- Redis 8.0.6 installed from the official Redis package repository in the existing `Ubuntu-20.04` WSL distribution.
- Redis listens on `127.0.0.1`/`::1` with protected mode enabled. Windows connects at `redis://127.0.0.1:6379`.
- The real Redis lease/presence/rate-limit integration test passed from Windows.
- Checksum-verified cloudflared 2026.9.3 is in the ignored `artifacts/cloudflared` folder.

## Host a session

Run from the repository root in PowerShell:

```powershell
.\scripts\playtest.ps1
```

The launcher starts Redis if needed, builds the game, starts a loopback backend/gateway, and opens the tunnel. It prints a URL and a random invite code. Share both privately with testers. Every new hosting run generates a new URL/code; restarting invalidates old login cookies. Keep the PC awake and the terminal open. Ctrl+C stops the game/tunnel; Redis stays local and running.

Already built, with Node and cloudflared in PATH:

```powershell
$env:REDIS_URL='redis://127.0.0.1:6379'
pnpm playtest:internet
```

The launcher reserves a free loopback port before creating the tunnel, so an existing host does not cause a port-3002 conflict. Each host is a separate game world; share one host's link with everyone. Startup errors name the failing stage and are saved to `artifacts/playtest-error.txt`. Do not expose Redis port 6379, the development server or the internal game-server port on your router/firewall.

## Join and test

1. Open the printed HTTPS link, enter the invite code and join Haven Town.
2. Use separate browser sessions/devices for separate players. Desktop offers WASD or click-to-walk; phones use the joystick/action buttons.
3. Prepare, accept a quest, travel together and test combat, parties, loot and reconnect.
4. Report the action, map and time when something fails. This is a disposable playtest: character items/progression reset when the host stops.

The browser cookie is Secure/HttpOnly/SameSite and expires after 12 hours. Login attempts are rate-limited through Redis; failure of Redis rejects new logins. Active player presence is refreshed in Redis every 15 seconds with 45-second expiry; failed presence refresh closes the affected connection. The game retains authoritative in-memory sessions. This does not implement durable accounts, inventory or cross-process world ownership.

## Redis commands

```powershell
wsl -d Ubuntu-20.04 -- redis-cli ping
# Run only the real Redis adapter test:
$env:TEST_REDIS_URL='redis://127.0.0.1:6379'
node --import tsx --test --test-name-pattern=Redis tests/persistence.integration.test.ts
# Stop Redis when local testing is finished:
wsl -d Ubuntu-20.04 -- redis-cli shutdown
```

On a different machine, install Redis using [official instructions](https://redis.io/docs/latest/operate/oss_and_stack/install/) and [cloudflared](https://developers.cloudflare.com/tunnel/get-started/), or use the Redis service in `infra/compose.yml`. Set `REDIS_URL` before launching when using Docker/another local instance. The provided Windows launcher defaults specifically to this machine's WSL distribution; it does not install software automatically.

Cloudflare documents Quick Tunnels as temporary testing infrastructure with a 200 in-flight-request limit, not a production availability guarantee: [Quick Tunnel documentation](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/). Start with a few friends. Test traffic passes through Cloudflare; no files outside the built assets are served. The gateway requires the exact tunnel Origin for WebSocket upgrades and rejects missing/forged invite cookies.

Automated gateway tests cover rejected invitations/origins/cookies, private-file denial, two-player joins, and fail-closed Redis/rate-limit behavior. Browser visual/mobile acceptance still requires the human playtest.
