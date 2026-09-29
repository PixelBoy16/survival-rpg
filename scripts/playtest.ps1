$ErrorActionPreference='Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$nodeCommand=Get-Command node -ErrorAction SilentlyContinue
$nodeExe=if($nodeCommand){$nodeCommand.Source}else{Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'}
if(-not (Test-Path -LiteralPath $nodeExe)){throw 'Node.js 22+ is required'}
if(-not $env:CLOUDFLARED_PATH){
  $tunnelCommand=Get-Command cloudflared -ErrorAction SilentlyContinue
  $env:CLOUDFLARED_PATH=if($tunnelCommand){$tunnelCommand.Source}else{Join-Path $PWD 'artifacts/cloudflared/cloudflared.exe'}
}
if(-not (Test-Path -LiteralPath $env:CLOUDFLARED_PATH)){throw 'Install cloudflared first. See docs/LOCAL_PLAYTEST.md'}
if(-not $env:REDIS_URL){
  & wsl -d Ubuntu-20.04 -u root --exec sh -lc 'if ! redis-cli ping >/dev/null 2>&1; then install -d -o redis -g redis /run/redis && runuser -u redis -- redis-server /etc/redis/redis.conf --daemonize yes --supervised no; fi'
  if($LASTEXITCODE -ne 0){throw 'Start local Redis first, or set REDIS_URL to an existing local instance'}
  Start-Sleep -Seconds 1
  $env:REDIS_URL='redis://127.0.0.1:6379'
}
& $nodeExe node_modules/typescript/bin/tsc -p tsconfig.server.json
if($LASTEXITCODE -ne 0){throw 'Server build failed'}
& $nodeExe node_modules/vite/bin/vite.js build
if($LASTEXITCODE -ne 0){throw 'Client build failed'}
& $nodeExe --import tsx scripts/playtest.ts
if($LASTEXITCODE -ne 0){
  if(Test-Path -LiteralPath 'artifacts/playtest-error.txt') {throw (Get-Content -LiteralPath 'artifacts/playtest-error.txt' -Raw)}
  throw "Playtest exited with code $LASTEXITCODE. See the startup error immediately above."
}
