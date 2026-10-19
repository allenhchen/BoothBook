import assert from 'node:assert/strict';
import { z } from 'zod';
import * as model from '../lib/model.ts';
import * as days from '../lib/convention-days.ts';
import { createTestDatabase, loadTypeScript } from './helpers/runtime.mjs';

const store = loadTypeScript('lib/artist-store.ts');
const { validateCatalog } = loadTypeScript('lib/workspace-api.ts', {
  './artist-store': store,
  './model': model,
  './convention-days': days,
  './fandom-colors': {},
  zod: { z },
});
const task = { id: 'winter-print', name: 'Winter print', start: '2026-12-20', deadline: '2027-01-10', status: 'in-progress', notes: 'Finish the ink layers.' };
const data = { ...store.emptyWorkspace, artTasks: [task] };
assert.equal(validateCatalog(store.emptyWorkspace).artTasks, undefined);
assert.equal(JSON.stringify(validateCatalog(data).artTasks), JSON.stringify([task]));
for (const start of ['', undefined]) {
  const withoutStart = { ...task, start };
  assert.equal(validateCatalog({ ...data, artTasks: [withoutStart] }).artTasks[0].deadline, task.deadline);
}
for (const patch of [
  { start: '2026-02-30' },
  { deadline: '2026-12-19' },
  { status: 'unknown' },
  { name: '   ' },
]) assert.throws(() => validateCatalog({ ...data, artTasks: [{ ...task, ...patch }] }));
assert.throws(() => validateCatalog({ ...data, artTasks: [task, task] }), /unique IDs/);

const { sqlite, db } = createTestDatabase();
try {
  const artist = { id: 'schedule-artist', email: 'art@example.test', displayName: 'Artist' };
  await store.openArtistWorkspace(db, artist);
  assert.equal(await store.writeArtistWorkspace(db, artist.id, 0, data), true);
  const saved = await store.readArtistWorkspace(db, artist.id);
  assert.equal(JSON.stringify(saved.data.artTasks), JSON.stringify([task]));
  const edited = { ...saved.data, artTasks: [{ ...task, start: '', status: 'completed' }] };
  assert.equal(await store.writeArtistWorkspace(db, artist.id, saved.version, edited), true);
  assert.equal((await store.readArtistWorkspace(db, artist.id)).data.artTasks[0].status, 'completed');
  assert.equal((await store.readArtistWorkspace(db, artist.id)).data.artTasks[0].start, '');
  assert.equal(await store.writeArtistWorkspace(db, artist.id, saved.version, data), false);
  const latest = await store.readArtistWorkspace(db, artist.id);
  assert.equal(await store.writeArtistWorkspace(db, artist.id, latest.version, { ...latest.data, artTasks: [] }), true);
  assert.equal((await store.readArtistWorkspace(db, artist.id)).data.artTasks.length, 0);
} finally {
  sqlite.close();
}
console.log('Art schedule validation, storage, editing, deletion, and stale-write checks passed.');
