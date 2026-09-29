$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$havenNode = Get-Command node -ErrorAction SilentlyContinue
if ($havenNode) { $havenExecutable = $havenNode.Source }
else {
    $havenExecutable = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (-not (Test-Path -LiteralPath $havenExecutable)) { throw 'Install Node.js 22 or newer, then run pnpm install.' }
}
if (-not (Test-Path -LiteralPath 'node_modules\vite')) { throw 'Dependencies missing. Run pnpm install first.' }
& $havenExecutable scripts/dev.mjs
