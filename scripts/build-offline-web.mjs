import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', join(root, 'standalone/vite.client.config.ts')], { cwd: root, env: { ...process.env, BOOTHBOOK_WEB_OFFLINE: '1' }, stdio: 'inherit' });
if (result.status !== 0)
  process.exit(result.status || 1);
function files(directory, prefix) { return readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(join(directory, e.name), prefix + e.name + '/') : [prefix + e.name]); }
const assets = files(join(root, 'public/offline'), '/offline/').sort();
const hash = createHash('sha256');
for (const asset of assets) {
  hash.update(asset);
  hash.update(readFileSync(join(root, 'public', asset)));
}
writeFileSync(join(root, 'public/offline/asset-list.json'), JSON.stringify(assets));
writeFileSync(join(root, 'public/boothbook-sw.js'), readFileSync(join(root, 'standalone/offline-worker.js'), 'utf8').replace('__ASSET_HASH__', hash.digest('hex').slice(0, 16)));
