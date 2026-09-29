import { spawn } from 'node:child_process';
const children = [['node_modules/tsx/dist/cli.mjs', 'apps/game-server/src/index.ts'], ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1']].map(args => spawn(process.execPath, args, { stdio: 'inherit' }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill(); process.exitCode = code; }
for (const child of children) child.on('exit', code => stop(code ?? 1));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
