import { spawnSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { databasePath, openLocalDatabase } from '../standalone/sqlite.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || major === 22 && minor < 18)
  throw Error('BoothBook Offline needs Node.js 22.18 or newer (Node.js 24 recommended).');
const lock = join(root, '.boothbook-running.json');
function running() {
  if (!existsSync(lock))
    return false; try {
      process.kill(JSON.parse(readFileSync(lock, 'utf8')).pid, 0);
      return true;
    }
  catch {
    return false;
  }
}
function command(binary, args) {
  const result = spawnSync(binary, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' && binary === 'pnpm' }); if (result.error)
    throw result.error; if (result.status !== 0)
    throw Error(`${binary} failed. Your database has not been deleted. See the output above.`);
}
function build() {
  if (running())
    throw Error('Stop BoothBook (Ctrl+C) before rebuilding.');
  command(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'standalone/vite.client.config.ts']);
  command(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'standalone/vite.server.config.ts']);
}
function snapshot(reason) {
  const local = openLocalDatabase(databasePath(), join(root, 'drizzle')); try {
    const output = local.snapshot(reason);
    console.log('Database backup: ' + output);
    return output;
  }
    finally {
    local.close();
  }
}
const action = process.argv[2];
if (action === 'build')
  build();
else if (action === 'backup')
  snapshot('manual');
else if (action === 'update') {
  if (running())
    throw Error('Stop BoothBook (Ctrl+C) before updating.');
  // Refuse to overwrite edited code or merge a divergent checkout.
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (status.error || status.status !== 0)
    throw Error('This is not a Git checkout. Follow the ZIP update steps in README.md.');
  if (status.stdout.trim())
    throw Error('Your code has local changes. Save/commit them before updating; BoothBook will not overwrite them.');
  snapshot('before-update');
  command('git', ['pull', '--ff-only']);
  command('pnpm', ['install', '--frozen-lockfile']);
  build();
  console.log('Update complete. Start with pnpm local:start. Database migrations run automatically at startup.');
}
else if (action === 'start') {
  if (running())
    throw Error('BoothBook is already running from this folder.');
  const entry = join(root, 'dist-local', 'server.mjs');
  if (!existsSync(entry))
    throw Error('Build first: pnpm local:build');
  const child = spawn(process.execPath, [entry], { cwd: root, stdio: 'inherit' });
  writeFileSync(lock, JSON.stringify({ pid: child.pid }), { mode: 0o600 });
  const clean = () => {
    if (existsSync(lock))
      unlinkSync(lock);
  };
  child.on('error', e => { clean(); console.error(e.message); process.exitCode = 1; });
  child.on('exit', code => { clean(); process.exitCode = code || 0; });
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => child.kill(signal));
}
else
  throw Error('Use build, start, backup, or update.');
