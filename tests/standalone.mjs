import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { seed } from '../lib/model.ts';
import { openLocalDatabase } from '../standalone/sqlite.mjs';
const temp = mkdtempSync(join(tmpdir(), 'boothbook-offline-test-')), release = join(temp, 'release'), database = join(temp, 'data', 'boothbook.sqlite');
mkdirSync(release);
cpSync('dist-local', join(release, 'dist-local'), { recursive: true });
cpSync('drizzle', join(release, 'drizzle'), { recursive: true });
const origin = 'http://127.0.0.1:4179';
let child, output = '';
async function start() {
  output = ''; child = spawn(process.execPath, [join(release, 'dist-local', 'server.mjs')], { cwd: release, env: { ...process.env, BOOTHBOOK_PORT: '4179', BOOTHBOOK_DB_PATH: database }, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.on('data', c => output += c); child.stderr.on('data', c => output += c); for (let n = 0;n < 80;n++) {
    if (child.exitCode !== null)
      throw Error(output);
    try {
      const r = await fetch(origin + '/api/workspace');
      if (r.ok)
        return await r.json();
    }
    catch { }
    await new Promise(r => setTimeout(r, 100));
  } throw Error('Local startup failed: ' + output);
}
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null)
    return; const done = new Promise(r => child.once('exit', r)); child.kill('SIGTERM'); await done;
}
async function post(route, input, extra = {}) {
  const r = await fetch(origin + route, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(input) }); const body = await r.text(); let data; try {
    data = JSON.parse(body);
  }
    catch {
      data = { error: body };
    } return { status: r.status, data };
}
try {
  let row = await start();
  assert.equal(row.artist.provider, 'local');
  assert.equal(row.data.items.length, 0);
  const home = await fetch(origin);
  assert.equal(home.status, 200);
  const html = await home.text();
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert(asset.startsWith('/assets/'));
  assert.equal((await fetch(origin + asset)).status, 200);
  assert.equal((await fetch(origin + '/account')).status, 200);
  const foreignHost = await new Promise((resolve, reject) => { const req = httpRequest(origin + '/api/workspace', { headers: { Host: 'evil.example:4179' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); });
  assert.equal(foreignHost, 403);
  assert.equal((await fetch(origin + '/api/workspace', { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await fetch(origin + '/api/backup', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await post('/api/workspace', { version: 0, action: 'workspace', data: seed }, { Origin: 'https://evil.example' })).status, 403);
  let result = await post('/api/workspace', { version: 0, action: 'workspace', data: seed });
  assert.equal(result.status, 200);
  assert.equal(result.data.version, 1);
  const units = ['design-0-foil', 'design-1-foil', 'design-2-foil'].map((itemId, n) => ({ id: String(n), itemId, poolId: 'p' }));
  result = await post('/api/workspace', { version: 1, action: 'sale', eventId: 'demo-event', saleDate: '2026-10-07', units, pools: [{ id: 'p', dealId: 'b2g1' }] });
  assert.equal(result.status, 200);
  assert.equal(result.data.data.sales[0].saleDate, '2026-10-07');
  assert.equal(result.data.data.sales[0].lines.reduce((n, l) => n + l.price - l.discount, 0), 8000);
  const backup = await (await fetch(origin + '/api/backup')).json();
  assert.equal(backup.data.sales.length, 1);
  await stop();
  row = await start();
  assert.equal(row.version, 2);
  assert.equal(row.data.items.length, seed.items.length);
  const report = await (await fetch(origin + '/api/workspace?eventId=demo-event')).json();
  assert.equal(report.data.sales.length, 1);
  const edited = structuredClone(backup);
  edited.data.items[0].name = 'Offline edited design';
  edited.data.sales[0].reference = 'Restored snapshot';
  edited.data.finance = [{ id: 'hotel', type: 'expense', category: 'convention', eventId: 'demo-event', conventionName: 'Demo convention', date: '2026-10-07', name: 'Hotel', amount: 20000 }, { id: 'past-total', type: 'earning', category: 'convention', eventId: 'historical:backup-test', conventionName: 'Past convention', conventionStart: '2024-05-01', conventionEnd: '2024-05-03', date: '2024-05-03', name: 'Past total', mode: 'total', amount: 50000 }, { id: 'past-hotel', type: 'expense', category: 'convention', eventId: 'historical:backup-test', conventionName: 'Past convention', conventionStart: '2024-05-01', date: '2024-05-01', name: 'Past hotel', amount: 5000 }];
  result = await post('/api/backup', { version: 2, confirm: 'replace', backup: edited });
  assert.equal(result.status, 200);
  assert.equal(result.data.version, 3);
  assert(readdirSync(join(temp, 'data', 'backups')).some(n => n.includes('before-restore')));
  const after = await (await fetch(origin + '/api/backup')).json();
  assert.equal(after.data.finance.find(e => e.id === 'hotel').amount, 20000);
  assert.equal(after.data.finance.find(e => e.id === 'past-total').conventionStart, '2024-05-01');
  assert.equal(after.data.finance.find(e => e.id === 'past-total').conventionEnd, '2024-05-03');
  assert.equal((await (await fetch(origin + '/api/finance?year=2024')).json()).summary.conventionTotal, 50000);
  assert.equal((await (await fetch(origin + '/api/finance?year=2024')).json()).summary.expenseTotal, 5000);
  assert((await (await fetch(origin + '/api/finance?year=2026')).json()).expenseConventions.some(c => c.id === 'historical:backup-test'));
  assert.equal((await (await fetch(origin + '/api/finance?year=2026')).json()).summary.net, -12000);
  assert.equal(after.data.items[0].name, 'Offline edited design');
  assert.equal(after.data.sales[0].reference, 'Restored snapshot');
  assert.equal(after.data.sales[0].saleDate, '2026-10-07');
  assert.equal((await post('/api/backup', { version: 2, confirm: 'replace', backup })).status, 409);
  const invalid = structuredClone(backup);
  invalid.data.sales[0].lines[0].discount = 100000;
  assert.equal((await post('/api/backup', { version: 3, confirm: 'replace', backup: invalid })).status, 400);
  assert.equal((await (await fetch(origin + '/api/workspace')).json()).version, 3);
  assert.equal((await post('/api/workspace', { version: 3, action: 'delete-sale', saleId: after.data.sales[0].id })).status, 200);
  await stop();
  row = await start();
  assert.equal(row.version, 4);
  assert.equal((await (await fetch(origin + '/api/backup')).json()).data.sales.length, 0);
  await stop();
  // Existing migrations aren't repeated; new ones back up and roll back on failure.
  const migrationRoot = join(release, 'drizzle'), journal = JSON.parse(readFileSync(join(migrationRoot, 'meta', '_journal.json'), 'utf8'));
  journal.entries.push({ idx: journal.entries.length, tag: '0003_test_failure' });
  writeFileSync(join(migrationRoot, 'meta', '_journal.json'), JSON.stringify(journal));
  writeFileSync(join(migrationRoot, '0003_test_failure.sql'), 'CREATE TABLE rollback_probe (id TEXT); INVALID SQL;');
  assert.throws(() => openLocalDatabase(database, migrationRoot));
  const raw = new DatabaseSync(database);
  assert.equal(raw.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE name='rollback_probe'").get().n, 0);
  raw.close();
  assert(readdirSync(join(temp, 'data', 'backups')).some(n => n.includes('before-migration')));
  journal.entries.pop();
  writeFileSync(join(migrationRoot, 'meta', '_journal.json'), JSON.stringify(journal));
  const local = openLocalDatabase(database, migrationRoot);
  const snapshot = local.snapshot('test');
  local.close();
  const saved = new DatabaseSync(snapshot);
  assert.equal(saved.prepare('SELECT version FROM artist_workspaces').get().version, 4);
  saved.close();
  writeFileSync(join(migrationRoot, journal.entries[0].tag + '.sql'), readFileSync(join(migrationRoot, journal.entries[0].tag + '.sql'), 'utf8') + '\n-- changed');
  assert.throws(() => openLocalDatabase(database, migrationRoot), /migrations differ/);
  console.log('Standalone release works without node_modules: local assets, checkout at $80, persistence across restarts, full backups/restores, stale/invalid import rejection, sale deletion, Host/Origin restrictions, migration rollback and SQLite snapshots passed.');
}
finally {
  await stop();
}
