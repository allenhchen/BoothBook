import { z } from 'zod';
import {
  openArtistWorkspace,
  readArtistWorkspace,
  type Artist,
  type Database,
} from './artist-store';
import { financeEntries, recordedIncome, writeFinanceEntry } from './finance-store';
import {
  financeSummary,
  financeEntrySchema,
  chronologicalEntries,
  expenseConventionOptions,
  earningsConventionOptions,
} from './finance';
export function createFinanceApi({
  database,
  authenticatedArtist,
  legacyOwnerEmail = '',
}: {
  database: () => Database;
  authenticatedArtist: () => Promise<Artist | null>;
  legacyOwnerEmail?: string;
}) {
  const headers = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
  async function GET(req: Request) {
    try {
      const artist = await authenticatedArtist();
      if (!artist)
        return Response.json({ error: 'Sign in to open finances.' }, { status: 401, headers });
      const year = z
          .string()
          .regex(/^$|^\d{4}$/)
          .parse(new URL(req.url).searchParams.get('year') || ''),
        db = database(),
        row = await openArtistWorkspace(db, artist, legacyOwnerEmail, '');
      const entries = await financeEntries(db, artist.id),
        recorded = await recordedIncome(db, artist.id, year);
      return Response.json(
        {
          version: row!.version,
          expenseConventions: expenseConventionOptions(row!.data, entries),
          earningsConventions: earningsConventionOptions(row!.data, entries),
          entries: chronologicalEntries(
            entries.filter((e) => !year || e.date.slice(0, 4) === year),
          ),
          years: [
            ...new Set([
              ...entries.map((e) => e.date.slice(0, 4)),
              ...row!.data.events.map((e) => e.start.slice(0, 4)),
            ]),
          ]
            .sort()
            .reverse(),
          summary: financeSummary(row!.data, entries, recorded, year),
        },
        { headers },
      );
    } catch {
      return Response.json(
        { error: 'Unable to load finances. Please retry online.' },
        { status: 503, headers },
      );
    }
  }
  async function POST(req: Request) {
    try {
      const artist = await authenticatedArtist();
      if (!artist)
        return Response.json(
          { error: 'Sign in before saving finances.' },
          { status: 401, headers },
        );
      if (req.headers.get('origin') !== new URL(req.url).origin)
        return Response.json({ error: 'Save from the app.' }, { status: 403, headers });
      const payload = z
          .object({
            version: z.number().int(),
            action: z.enum(['save', 'delete']),
            entry: z.unknown().optional(),
            id: z.string().optional(),
          })
          .parse(await req.json()),
        db = database(),
        row = await readArtistWorkspace(db, artist.id, '');
      if (!row || row.version !== payload.version)
        return Response.json(
          { error: 'Data changed in another tab. Reload before saving.' },
          { status: 409, headers },
        );
      const existing = await financeEntries(db, artist.id);
      let entry =
        payload.action === 'delete'
          ? existing.find((e) => e.id === payload.id)
          : financeEntrySchema.parse(payload.entry);
      if (!entry) throw Error('Entry no longer exists. Reload finances.');
      if (payload.action === 'save' && entry.category === 'convention') {
        const event = row.data.events.find((e) => e.id === entry!.eventId),
          previous = existing.find((e) => e.id === entry!.id),
          historical =
            existing.find(
              (e) =>
                e.type === 'earning' && e.category === 'convention' && e.eventId === entry!.eventId,
            ) || existing.find((e) => e.category === 'convention' && e.eventId === entry!.eventId);
        if (
          event &&
          (event.status === 'accepted' ||
            (historical &&
              (entry.type === 'expense' ||
                existing.some(
                  (e) =>
                    e.type === 'earning' &&
                    e.category === 'convention' &&
                    e.eventId === entry!.eventId,
                ))))
        )
          entry = {
            ...entry,
            conventionName: event.name,
            conventionStart: event.start,
            conventionEnd: event.end,
          };
        else if (previous && previous.eventId === entry.eventId)
          entry = {
            ...entry,
            conventionName: entry.conventionName || previous.conventionName,
            conventionStart: entry.conventionStart || previous.conventionStart,
            conventionEnd: entry.conventionEnd || previous.conventionEnd,
          };
        else if (
          !event &&
          (historical || (entry.type === 'earning' && entry.eventId?.startsWith('historical:')))
        ) {
          if (historical)
            entry = {
              ...entry,
              conventionName: historical.conventionName,
              conventionStart: historical.conventionStart || historical.date,
              conventionEnd:
                historical.conventionEnd ||
                (historical.type === 'earning' && historical.mode === 'total'
                  ? historical.date
                  : undefined),
            };
          if (!entry.conventionName || !entry.conventionStart)
            throw Error('Enter the past convention name and start date.');
        } else
          throw Error(
            entry.type === 'expense'
              ? 'Select an accepted or previously entered convention.'
              : 'Choose an accepted or manually entered convention.',
          );
        if (entry.type === 'earning' && !event) {
          entry = { ...entry, conventionEnd: entry.conventionEnd || entry.date };
          if (entry.conventionEnd! < entry.conventionStart!)
            throw Error('End date must be on or after the start date.');
        }
        entry = financeEntrySchema.parse(entry);
        if (
          entry.type === 'earning' &&
          entry.mode === 'total' &&
          existing.some(
            (e) =>
              e.id !== entry!.id &&
              e.type === 'earning' &&
              e.category === 'convention' &&
              e.eventId === entry!.eventId &&
              e.mode === 'total',
          )
        )
          throw Error('This convention already has a manual total. Edit that entry instead.');
      }
      if (
        !(await writeFinanceEntry(db, artist.id, row.version, entry, payload.action === 'delete'))
      )
        return Response.json(
          { error: 'Data changed in another tab. Reload before saving.' },
          { status: 409, headers },
        );
      return Response.json({ version: row.version + 1 }, { headers });
    } catch (e) {
      return Response.json(
        {
          error:
            e instanceof z.ZodError
              ? 'Check the date, name, amount and category.'
              : e instanceof Error
                ? e.message
                : 'Unable to save.',
        },
        { status: 400, headers },
      );
    }
  }
  return { GET, POST };
}
