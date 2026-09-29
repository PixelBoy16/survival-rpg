import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const tests = readdirSync('tests').filter(name => name.endsWith('.test.ts')).map(name => `tests/${name}`);
for (const args of [ ['node_modules/typescript/bin/tsc','--noEmit'], ['node_modules/eslint/bin/eslint.js','.'], ['node_modules/tsx/dist/cli.mjs','--test',...tests], ['node_modules/typescript/bin/tsc','-p','tsconfig.server.json'], ['node_modules/vite/bin/vite.js','build'] ]) {
  const result = spawnSync(process.execPath, args, { stdio:'inherit' });
  if (result.error) console.error(result.error);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
