import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--tests-only'))
  throw Error('Usage: node scripts/check.mjs [--tests-only]');
function run(script, ...parameters) {
  const result = spawnSync(process.execPath, [script, ...parameters], { cwd: root, stdio: 'inherit' });
  if (result.error)
    throw result.error;
  if (result.status !== 0)
    process.exit(result.status || 1);
}
if (!args.includes('--tests-only'))
  run('node_modules/typescript/bin/tsc', '--noEmit');
run('scripts/local.mjs', 'build');
run('scripts/build-offline-web.mjs');
for (const test of readdirSync('tests').filter(name => name.endsWith('.mjs')).sort())
  run('tests/' + test);
console.log('All BoothBook checks passed.');
