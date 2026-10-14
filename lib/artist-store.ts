import { type Workspace } from './model';
export type Artist = {
  id: string;
  email: string;
  displayName: string;
  provider: 'chatgpt' | 'google' | 'local';
};
export type Database = {
  prepare: (sql: string) => any;
  batch: (statements: any[]) => Promise<any>;
};
export const emptyWorkspace: Workspace = { categories: [], items: [], deals: [], events: [], sales: [] };
export function artistKey(provider: Artist['provider'], subject: string) {
  if (!subject || subject.length > 200)
    throw Error('Invalid authenticated identity.'); return `${provider}:${subject}`;
}
export async function openArtistWorkspace(db: Database, artist: Artist, legacyOwnerEmail: string, eventId?: string) {
  const existing = await db.prepare('SELECT w.version,w.data,w.sales_migrated,a.email,a.display_name FROM artist_workspaces w JOIN artists a ON a.id=w.artist_id WHERE w.artist_id=?').bind(artist.id).first();
  if (existing?.sales_migrated === 1 && existing.email === artist.email && existing.display_name === artist.displayName)
    return readArtistWorkspace(db, artist.id, eventId, existing);
  await db.prepare('INSERT INTO artists (id, email, display_name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name').bind(artist.id, artist.email, artist.displayName).run();
  // Only the explicitly configured original owner can claim the legacy workspace.
  if (legacyOwnerEmail && artist.provider === 'chatgpt' && artist.email.toLowerCase() === legacyOwnerEmail.toLowerCase()) {
    await db.batch([
      db.prepare('INSERT OR IGNORE INTO legacy_claims (legacy_id, artist_id) SELECT ?, ? WHERE EXISTS (SELECT 1 FROM workspace WHERE id = ?)').bind('main', artist.id, 'main'),
      db.prepare('INSERT OR IGNORE INTO artist_workspaces (artist_id, version, data) SELECT ?, version, data FROM workspace WHERE id = ? AND EXISTS (SELECT 1 FROM legacy_claims WHERE legacy_id = ? AND artist_id = ?)').bind(artist.id, 'main', 'main', artist.id)
    ]);
  }
  await db.prepare('INSERT OR IGNORE INTO artist_workspaces (artist_id, version, data) VALUES (?, ?, ?)').bind(artist.id, 0, JSON.stringify(emptyWorkspace)).run();
  await migrateSales(db, artist.id);
  return readArtistWorkspace(db, artist.id, eventId);
}
/** One atomic, repeatable import. JSON is retained until all transactions are copied. */
async function migrateSales(db: Database, artistId: string) {
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO artist_sales (artist_id,id,event_id,date,data)
 SELECT artist_id,json_extract(value,'$.id'),COALESCE(json_extract(value,'$.eventId'),''),COALESCE(json_extract(value,'$.date'),''),value
 FROM artist_workspaces,json_each(artist_workspaces.data,'$.sales') WHERE artist_id=? AND sales_migrated=0`).bind(artistId),
    db.prepare("UPDATE artist_workspaces SET data=json_set(data,'$.sales',json('[]')),sales_migrated=1 WHERE artist_id=? AND sales_migrated=0").bind(artistId)
  ]);
}
export async function readArtistWorkspace(db: Database, artistId: string, eventId?: string, knownRow?: {
  version: number;
  data: string;
}) {
  const row = knownRow ?? await db.prepare('SELECT version, data FROM artist_workspaces WHERE artist_id = ?').bind(artistId).first() as {
    version: number;
    data: string;
  } | null;
  if (!row)
    return null;
  const data = JSON.parse(row.data) as Workspace;
  // Empty string requests catalog only; undefined is for maintenance/backups.
  const result = eventId === '' ? { results: [] } : await db.prepare('SELECT data FROM artist_sales WHERE artist_id = ?' + (eventId === undefined ? '' : ' AND event_id = ?') + ' ORDER BY date, id').bind(...(eventId === undefined ? [artistId] : [artistId, eventId])).all();
  data.sales = result.results.map((r: {
    data: string;
  }) => JSON.parse(r.data));
  return { version: row.version, data };
}
export async function saleEvent(db: Database, artistId: string, saleId: string) { return (await db.prepare('SELECT event_id FROM artist_sales WHERE artist_id=? AND id=?').bind(artistId, saleId).first())?.event_id as string | undefined; }
export async function findSale(db: Database, artistId: string, saleId: string) { const row = await db.prepare('SELECT data FROM artist_sales WHERE artist_id=? AND id=?').bind(artistId, saleId).first(); return row ? JSON.parse(row.data) : null; }
/** Version gate and all changes share one D1 transaction. Failed gates perform no writes. */
export async function writeArtistWorkspace(db: Database, artistId: string, version: number, data: Workspace, previous?: Workspace) {
  const before = previous || (await readArtistWorkspace(db, artistId))?.data;
  if (!before)
    return false;
  const token = crypto.randomUUID(), catalog = { ...data, sales: [], finance: undefined }, oldCatalog = { ...before, sales: [], finance: undefined };
  const statements = [db.prepare('UPDATE artist_workspaces SET version=version+1,mutation=? WHERE artist_id=? AND version=?').bind(token, artistId, version)];
  if (JSON.stringify(catalog) !== JSON.stringify(oldCatalog))
    statements.push(db.prepare('UPDATE artist_workspaces SET data=? WHERE artist_id=? AND mutation=?').bind(JSON.stringify(catalog), artistId, token));
  // Convention deletion removes every historical transaction, even when history
  // was not loaded. Freed SQLite pages are reusable by future sales.
  for (const event of before.events)
    if (!data.events.some(e => e.id === event.id))
      statements.push(db.prepare('DELETE FROM artist_sales WHERE artist_id=? AND event_id=? AND EXISTS (SELECT 1 FROM artist_workspaces WHERE artist_id=? AND mutation=?)').bind(artistId, event.id, artistId, token));
  const old = new Map(before.sales.map(s => [s.id, s])), next = new Map(data.sales.map(s => [s.id, s]));
  for (const sale of data.sales) {
    if (!old.has(sale.id))
      statements.push(db.prepare('INSERT INTO artist_sales (artist_id,id,event_id,date,data) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM artist_workspaces WHERE artist_id=? AND mutation=?)').bind(artistId, sale.id, sale.eventId, sale.date, JSON.stringify(sale), artistId, token));
    else if (JSON.stringify(old.get(sale.id)) !== JSON.stringify(sale))
      statements.push(db.prepare('UPDATE artist_sales SET event_id=?,date=?,data=? WHERE artist_id=? AND id=? AND EXISTS (SELECT 1 FROM artist_workspaces WHERE artist_id=? AND mutation=?)').bind(sale.eventId, sale.date, JSON.stringify(sale), artistId, sale.id, artistId, token));
  }
  for (const sale of before.sales)
    if (!next.has(sale.id))
      statements.push(db.prepare('DELETE FROM artist_sales WHERE artist_id=? AND id=? AND EXISTS (SELECT 1 FROM artist_workspaces WHERE artist_id=? AND mutation=?)').bind(artistId, sale.id, artistId, token));
  // Only full offline backup restore supplies finance; catalog edits never do.
  if (data.finance !== undefined) {
    statements.push(db.prepare('DELETE FROM artist_finance WHERE artist_id=? AND EXISTS(SELECT 1 FROM artist_workspaces WHERE artist_id=? AND mutation=?)').bind(artistId, artistId, token));
    for (const entry of data.finance)
      statements.push(db.prepare('INSERT INTO artist_finance (artist_id,id,date,type,event_id,data) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM artist_workspaces WHERE artist_id=? AND mutation=?)').bind(artistId, entry.id, entry.date, entry.type, entry.eventId || null, JSON.stringify(entry), artistId, token));
  }
  const results = await db.batch(statements);
  return !!results[0].meta.changes;
}
