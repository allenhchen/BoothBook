import {
  openArtistWorkspace,
  readArtistWorkspace,
  writeArtistWorkspace,
  saleEvent,
  findSale,
  type Database,
  type Artist,
} from './artist-store';
import { calculate, validCategoryDepth, type Workspace } from './model';
import { z } from 'zod';
import { validDay, defaultSaleDay } from './convention-days';
import { assignFandomColors } from './fandom-colors';
const named = z.string().trim().min(1).max(160),
  id = z.string().min(1).max(100);
const schema = z.object({
  fandomColors: z.record(z.number().int().min(0).max(359)).optional(),
  categories: z
    .array(
      z.object({
        id,
        name: named,
        parentId: id.nullable(),
        price: z.number().int().min(0).max(10000000).nullable(),
      }),
    )
    .max(1000),
  items: z
    .array(
      z.object({
        id,
        name: named,
        categoryId: id.nullable(),
        fandom: z.string().trim().max(160).optional(),
      }),
    )
    .max(10000),
  deals: z
    .array(
      z.object({
        id,
        name: named,
        buy: z.number().int().min(1).max(100),
        free: z.number().int().min(0).max(100),
        kind: z.enum(['free', 'amount', 'percent']).optional(),
        discountValue: z.number().min(0).max(10000000).optional(),
        categoryIds: z.array(id),
        itemIds: z
          .array(id)
          .optional()
          .transform(() => []),
      }),
    )
    .max(200),
  events: z
    .array(
      z.object({
        id,
        name: named,
        start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(['awaiting', 'rejected', 'waitlisted', 'accepted']),
      }),
    )
    .max(1000),
});
export function validateCatalog(input: unknown) {
  const parsed = schema.parse(input);
  if (!validCategoryDepth(parsed.categories)) throw Error('Only one subcategory level is allowed.');
  for (const d of parsed.deals) {
    if ((!d.kind || d.kind === 'free') && d.free < 1)
      throw Error('Free item count must be positive.');
    if (
      d.kind &&
      d.kind !== 'free' &&
      (!d.discountValue || (d.kind === 'percent' && d.discountValue > 100))
    )
      throw Error('Enter a valid discount.');
  }
  for (const c of parsed.categories) {
    if (c.parentId && !parsed.categories.some((p) => p.id === c.parentId))
      throw Error('Parent category is missing.');
    let p = c;
    const seen = new Set<string>();
    while (p) {
      if (seen.has(p.id)) throw Error('Category hierarchy contains a cycle.');
      seen.add(p.id);
      p = parsed.categories.find((x) => x.id === p.parentId)!;
    }
  }
  for (const i of parsed.items)
    if (
      i.categoryId !== null &&
      (!parsed.categories.some((c) => c.id === i.categoryId) ||
        parsed.categories.some((c) => c.parentId === i.categoryId))
    )
      throw Error('Items must belong to a lowest-level category.');
  for (const e of parsed.events)
    if (!validDay(e.start) || !validDay(e.end) || e.end < e.start)
      throw Error('Enter valid convention dates with the end on or after the start.');
  return parsed;
}
export function createWorkspaceApi({
  database,
  authenticatedArtist,
  legacyOwnerEmail = '',
}: {
  database: () => Database;
  authenticatedArtist: () => Promise<Artist | null>;
  legacyOwnerEmail?: string;
}) {
  const responseHeaders = { 'Cache-Control': 'no-store, private', Vary: 'Cookie' };
  async function GET(req?: Request) {
    try {
      const artist = await authenticatedArtist();
      if (!artist)
        return Response.json(
          { error: 'Sign in to open your artist workspace.' },
          { status: 401, headers: responseHeaders },
        );
      const row = await openArtistWorkspace(database(), artist, legacyOwnerEmail, '');
      const eventId = req ? new URL(req.url).searchParams.get('eventId') || '' : '';
      const etag = '"v' + row!.version + ':' + encodeURIComponent(eventId) + '"';
      if (req?.headers.get('if-none-match') === etag)
        return new Response(null, { status: 304, headers: { ...responseHeaders, ETag: etag } });
      const scoped = eventId
        ? await readArtistWorkspace(database(), artist.id, eventId, {
            version: row!.version,
            data: JSON.stringify(row!.data),
          })
        : row;
      return Response.json({ ...scoped, artist }, { headers: { ...responseHeaders, ETag: etag } });
    } catch (e) {
      console.error(e);
      return Response.json(
        { error: 'Unable to load saved data. Please retry.' },
        { status: 503, headers: responseHeaders },
      );
    }
  }
  async function POST(req: Request) {
    try {
      const artist = await authenticatedArtist();
      if (!artist)
        return Response.json(
          { error: 'Sign in before saving.' },
          { status: 401, headers: responseHeaders },
        );
      if (req.headers.get('origin') !== new URL(req.url).origin)
        return Response.json({ error: 'This request must come from the app.' }, { status: 403 });
      const payload = z
        .object({
          version: z.number().int(),
          action: z.string(),
          saleId: id.optional(),
          clientSaleId: z.string().uuid().optional(),
          expectedLines: z.unknown().optional(),
          recordedAt: z.string().datetime({ offset: true }).optional(),
          data: z.unknown().optional(),
          eventId: z.string().optional(),
          saleDate: z.string().optional(),
          units: z.unknown().optional(),
          pools: z.unknown().optional(),
          reference: z.string().optional(),
          manualDiscount: z
            .object({ kind: z.enum(['amount', 'percent']), value: z.number().min(0).max(10000000) })
            .optional(),
        })
        .parse(await req.json());
      const db = database();
      if (payload.action === 'sale' && payload.clientSaleId) {
        const existing = await findSale(db, artist.id, payload.clientSaleId);
        if (existing) {
          const latest = await readArtistWorkspace(db, artist.id, '');
          if (
            existing.eventId !== payload.eventId ||
            existing.saleDate !== payload.saleDate ||
            existing.reference !== (payload.reference || '') ||
            JSON.stringify(existing.lines) !== JSON.stringify(payload.expectedLines)
          )
            return Response.json(
              { error: 'Queued sale identifier conflicts with an existing sale.' },
              { status: 409 },
            );
          return Response.json(
            { data: { ...latest!.data, sales: [existing] }, version: latest!.version },
            { headers: responseHeaders },
          );
        }
      }
      const scope =
        payload.action === 'delete-sale'
          ? await saleEvent(db, artist.id, payload.saleId || '')
          : payload.action === 'sale' ||
              payload.action === 'delete-convention' ||
              payload.action === 'workspace'
            ? ''
            : payload.eventId;
      const row = await readArtistWorkspace(db, artist.id, scope || '');
      if (!row || payload.version !== row.version)
        return Response.json(
          { error: 'Data changed in another tab. Reload before saving.' },
          { status: 409 },
        );
      const current = row.data;
      let next: Workspace;
      if (payload.action === 'delete-convention') {
        const eventId = id.parse(payload.eventId);
        if (!current.events.some((e) => e.id === eventId))
          throw Error('Convention no longer exists. Reload your list.');
        next = {
          ...current,
          events: current.events.filter((e) => e.id !== eventId),
          sales: current.sales.filter((s) => s.eventId !== eventId),
        };
      } else if (payload.action === 'delete-sale') {
        const saleId = id.parse(payload.saleId);
        if (!current.sales.some((s) => s.id === saleId))
          throw Error('Sale no longer exists. Reload your dashboard.');
        next = { ...current, sales: current.sales.filter((s) => s.id !== saleId) };
      } else if (payload.action === 'sale') {
        const event = current.events.find((e) => e.id === payload.eventId);
        if (!event || event.status !== 'accepted') throw Error('Select an accepted convention.');
        const saleDate =
          payload.saleDate ?? defaultSaleDay(event, new Date().toISOString().slice(0, 10));
        if (!validDay(saleDate) || saleDate < event.start || saleDate > event.end)
          throw Error('Choose a sale day within the convention dates.');
        const units = z
          .array(z.object({ id, itemId: id, poolId: z.string().max(100) }))
          .min(1)
          .max(500)
          .parse(payload.units);
        const pools = z
          .array(z.object({ id, dealId: id }))
          .max(100)
          .parse(payload.pools);
        if (
          new Set(units.map((u) => u.id)).size !== units.length ||
          new Set(pools.map((p) => p.id)).size !== pools.length
        )
          throw Error('Duplicate cart identifiers.');
        const result = calculate(current, units, pools, payload.manualDiscount);
        const snapshot = result.lines.map(
          ({ itemId, name, fandom, category, price, discount, deal }) => ({
            itemId,
            name,
            fandom,
            category,
            price,
            discount,
            deal,
          }),
        );
        if (
          payload.clientSaleId &&
          JSON.stringify(snapshot) !== JSON.stringify(payload.expectedLines)
        )
          return Response.json(
            {
              error:
                'Catalog or deal details changed. This pending sale needs review; it has not been altered or saved.',
            },
            { status: 409 },
          );
        next = {
          ...current,
          sales: [
            ...current.sales,
            {
              id: payload.clientSaleId || crypto.randomUUID(),
              eventId: event.id,
              date:
                payload.clientSaleId && payload.recordedAt
                  ? payload.recordedAt
                  : new Date().toISOString(),
              saleDate,
              reference: z
                .string()
                .max(160)
                .parse(payload.reference || ''),
              manualDiscount: payload.manualDiscount,
              lines: result.lines.map(
                ({ itemId, name, fandom, category, price, discount, deal }) => ({
                  itemId,
                  name,
                  fandom,
                  category,
                  price,
                  discount,
                  deal,
                }),
              ),
            },
          ],
        };
      } else {
        const parsed = validateCatalog(payload.data);
        next = {
          ...parsed,
          fandomColors: assignFandomColors(
            parsed.items.map((i) => i.fandom || ''),
            { ...parsed.fandomColors, ...current.fandomColors },
          ),
          sales: current.sales.filter((s) => parsed.events.some((e) => e.id === s.eventId)),
        };
      }
      const saved = await writeArtistWorkspace(db, artist.id, row.version, next, current);
      if (!saved)
        return Response.json(
          { error: 'Data changed in another tab. Reload before saving.' },
          { status: 409 },
        );
      return Response.json({ data: next, version: row.version + 1 }, { headers: responseHeaders });
    } catch (e) {
      return Response.json(
        {
          error:
            e instanceof z.ZodError
              ? 'Please check the entered values.'
              : e instanceof Error
                ? e.message
                : 'Unable to save.',
        },
        { status: 400 },
      );
    }
  }
  return { GET, POST };
}
