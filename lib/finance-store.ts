import type { Database } from './artist-store';
import type { FinanceEntry, RecordedIncome } from './finance';
export async function financeEntries(db: Database, artistId: string): Promise<FinanceEntry[]> {
  const result = await db
    .prepare('SELECT data FROM artist_finance WHERE artist_id=? ORDER BY date DESC,id')
    .bind(artistId)
    .all();
  return result.results.map((r: { data: string }) => JSON.parse(r.data));
}
export async function recordedIncome(
  db: Database,
  artistId: string,
  year: string,
): Promise<RecordedIncome[]> {
  const result = await db
    .prepare(
      `SELECT s.event_id AS eventId,SUM(CAST(json_extract(line.value,'$.price') AS INTEGER)-CAST(json_extract(line.value,'$.discount') AS INTEGER)) AS total,COUNT(DISTINCT s.id) AS transactions FROM artist_sales s,json_each(s.data,'$.lines') line WHERE s.artist_id=? AND (?='' OR substr(COALESCE(json_extract(s.data,'$.saleDate'),json_extract(s.data,'$.date')),1,4)=?) GROUP BY s.event_id`,
    )
    .bind(artistId, year, year)
    .all();
  return result.results;
}
export async function writeFinanceEntry(
  db: Database,
  artistId: string,
  version: number,
  entry: FinanceEntry,
  remove = false,
) {
  const token = crypto.randomUUID();
  const statements = [
    db
      .prepare(
        'UPDATE artist_workspaces SET version=version+1,mutation=? WHERE artist_id=? AND version=?',
      )
      .bind(token, artistId, version),
  ];
  if (remove)
    statements.push(
      db
        .prepare(
          'DELETE FROM artist_finance WHERE artist_id=? AND id=? AND EXISTS(SELECT 1 FROM artist_workspaces WHERE artist_id=? AND mutation=?)',
        )
        .bind(artistId, entry.id, artistId, token),
    );
  else
    statements.push(
      db
        .prepare(
          `INSERT INTO artist_finance (artist_id,id,date,type,event_id,data) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM artist_workspaces WHERE artist_id=? AND mutation=?) ON CONFLICT(artist_id,id) DO UPDATE SET date=excluded.date,type=excluded.type,event_id=excluded.event_id,data=excluded.data`,
        )
        .bind(
          artistId,
          entry.id,
          entry.date,
          entry.type,
          entry.eventId || null,
          JSON.stringify(entry),
          artistId,
          token,
        ),
    );
  const results = await db.batch(statements);
  return !!results[0].meta.changes;
}
