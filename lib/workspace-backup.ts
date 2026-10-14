import { z } from 'zod';
import { validateCatalog } from './workspace-api';
import { openArtistWorkspace, readArtistWorkspace, writeArtistWorkspace, type Database, type Artist } from './artist-store';
import type { Workspace } from './model';
import { validDay } from './convention-days';
import { financeEntrySchema } from './finance';
import { financeEntries } from './finance-store';
const id = z.string().min(1).max(100), text = z.string().max(1000), amount = z.number().int().min(0).max(10000000);
const line = z.object({ itemId: id, name: text, category: text, fandom: text.optional(), price: amount, discount: amount, deal: text }).refine(l => l.discount <= l.price, 'A discount cannot exceed the original price.');
const sale = z.object({ id, eventId: id, date: z.string().datetime({ offset: true }), saleDate: z.string().refine(validDay).optional(), reference: text, manualDiscount: z.object({ kind: z.enum(['amount', 'percent']), value: z.number().min(0).max(10000000) }).optional(), lines: z.array(line).min(1).max(500) });
export function parseBackup(input: unknown): Workspace {
  const envelope = z.object({ app: z.literal('BoothBook'), formatVersion: z.literal(1), data: z.object({ sales: z.array(sale).max(100000) }).passthrough() }).parse(input);
  const financial = z.array(financeEntrySchema).max(100000).parse(envelope.data.finance || []);
  const data = { ...validateCatalog(envelope.data), sales: envelope.data.sales, finance: financial };
  for (const group of [data.categories, data.items, data.deals, data.events, data.sales])
    if (new Set(group.map(x => x.id)).size !== group.length)
      throw Error('The backup contains duplicate IDs.');
  if (data.sales.some(s => !data.events.some(e => e.id === s.eventId)))
    throw Error('The backup contains sales for a missing convention.');
  if (new Set(financial.map(e => e.id)).size !== financial.length)
    throw Error('Duplicate financial entry IDs in backup.');
  const overrides = financial.filter(e => e.type === 'earning' && e.category === 'convention' && e.mode === 'total');
  if (new Set(overrides.map(e => e.eventId)).size !== overrides.length)
    throw Error('Duplicate manual convention totals in backup.');
  return data;
}
export function createBackupApi({ database, authenticatedArtist, beforeImport, legacyOwnerEmail = '' }: {
  database: () => Database;
  authenticatedArtist: () => Promise<Artist | null>;
  beforeImport?: () => void;
  legacyOwnerEmail?: string;
}) {
  const headers = { 'Cache-Control': 'no-store, private', 'Vary': 'Cookie' };
  async function GET() {
    try {
      const artist = await authenticatedArtist();
      if (!artist)
        return Response.json({ error: 'Sign in before exporting your workspace.' }, { status: 401, headers });
      const row = await openArtistWorkspace(database(), artist, legacyOwnerEmail);
      return Response.json({ app: 'BoothBook', formatVersion: 1, exportedAt: new Date().toISOString(), data: { ...row!.data, finance: await financeEntries(database(), artist.id) } }, { headers: { ...headers, 'Content-Disposition': 'attachment; filename="BoothBook-workspace.json"' } });
    }
    catch {
      return Response.json({ error: 'Unable to export the workspace. Please retry.' }, { status: 503, headers });
    }
  }
  async function POST(req: Request) {
    try {
      // Not a browser flag: only the loopback-only standalone server enables this.
      if (!beforeImport)
        return Response.json({ error: 'Restore is available only in the offline app.' }, { status: 403, headers });
      const artist = await authenticatedArtist();
      if (!artist)
        return Response.json({ error: 'Workspace unavailable.' }, { status: 401, headers });
      if (req.headers.get('origin') !== new URL(req.url).origin)
        return Response.json({ error: 'Restore must come from this app.' }, { status: 403, headers });
      const input = z.object({ version: z.number().int().min(0), confirm: z.literal('replace'), backup: z.unknown() }).parse(await req.json());
      const data = parseBackup(input.backup), row = await readArtistWorkspace(database(), artist.id);
      if (!row || input.version !== row.version)
        return Response.json({ error: 'Data changed in another tab. Reload before restoring.' }, { status: 409, headers });
      beforeImport();
      if (!await writeArtistWorkspace(database(), artist.id, row.version, data, row.data))
        return Response.json({ error: 'Data changed in another tab. Reload before restoring.' }, { status: 409, headers });
      return Response.json({ data: { ...data, sales: [] }, version: row.version + 1 }, { headers });
    }
    catch (e) {
      return Response.json({ error: e instanceof z.ZodError ? 'This is not a valid BoothBook workspace backup.' : e instanceof Error ? e.message : 'Unable to restore.' }, { status: 400, headers });
    }
  }
  return { GET, POST };
}
