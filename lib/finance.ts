import { z } from 'zod';
import { validDay } from './convention-days';
import type { Workspace } from './model';
export const financeEntrySchema = z
  .object({
    id: z.string().min(1).max(100),
    type: z.enum(['expense', 'earning']),
    category: z.enum(['convention', 'inventory', 'setup', 'commission', 'creator']),
    date: z.string().refine(validDay, 'Enter a valid date.'),
    name: z.string().trim().min(1).max(160),
    amount: z.number().int().min(1).max(100000000),
    eventId: z.string().min(1).max(100).nullable().optional(),
    conventionName: z.string().trim().min(1).max(160).optional(),
    conventionStart: z.string().refine(validDay, 'Enter a valid convention start date.').optional(),
    conventionEnd: z.string().refine(validDay, 'Enter a valid convention end date.').optional(),
    mode: z.enum(['total', 'extra']).optional(),
  })
  .superRefine((e, ctx) => {
    if (e.conventionStart && e.conventionEnd && e.conventionEnd < e.conventionStart)
      ctx.addIssue({ code: 'custom', message: 'End date must be on or after the start date.' });
    if (
      (e.type === 'expense' && !['convention', 'inventory', 'setup'].includes(e.category)) ||
      (e.type === 'earning' && !['convention', 'commission', 'creator'].includes(e.category))
    )
      ctx.addIssue({ code: 'custom', message: 'Choose a matching expense or earning category.' });
    if (e.category === 'convention' && !e.eventId)
      ctx.addIssue({ code: 'custom', message: 'Choose a convention.' });
    if (e.type === 'earning' && e.category === 'convention' && !e.mode)
      ctx.addIssue({ code: 'custom', message: 'Choose total or additional earnings.' });
  });
export type FinanceEntry = z.infer<typeof financeEntrySchema>;
export type RecordedIncome = {
  eventId: string;
  total: number;
  transactions: number;
};
export function chronologicalEntries(entries: FinanceEntry[]) {
  return entries
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
}
export function expenseConventionOptions(w: Workspace, entries: FinanceEntry[]) {
  const options = new Map(
    w.events
      .filter((e) => e.status === 'accepted')
      .map((e) => [e.id, { id: e.id, name: e.name, start: e.start, end: e.end }]),
  );
  for (const entry of chronologicalEntries(entries.filter((e) => e.category === 'convention'))) {
    if (!entry.eventId || options.has(entry.eventId)) continue;
    const event = w.events.find((e) => e.id === entry.eventId),
      related = entries.filter((e) => e.category === 'convention' && e.eventId === entry.eventId);
    options.set(entry.eventId, {
      id: entry.eventId,
      name: event?.name || entry.conventionName || 'Removed convention',
      start: event?.start || entry.conventionStart || entry.date,
      end:
        event?.end ||
        related.find((e) => e.conventionEnd)?.conventionEnd ||
        related.find((e) => e.type === 'earning' && e.mode === 'total')?.date ||
        '',
    });
  }
  return [...options.values()].sort(
    (a, b) =>
      a.start.localeCompare(b.start) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}
export function earningsConventionOptions(w: Workspace, entries: FinanceEntry[]) {
  return expenseConventionOptions(w, entries).filter(
    (c) =>
      w.events.some((e) => e.id === c.id && e.status === 'accepted') ||
      c.id.startsWith('historical:') ||
      entries.some(
        (e) => e.type === 'earning' && e.category === 'convention' && e.eventId === c.id,
      ),
  );
}
export function financeSummary(
  w: Workspace,
  entries: FinanceEntry[],
  recorded: RecordedIncome[],
  year: string,
) {
  const matches = (e: FinanceEntry) => !year || e.date.slice(0, 4) === year;
  const selected = chronologicalEntries(entries.filter(matches));
  const manual = entries.filter((e) => e.type === 'earning' && e.category === 'convention');
  const ids = new Set([
    ...w.events.filter((e) => e.status === 'accepted').map((e) => e.id),
    ...manual.map((e) => e.eventId!),
  ]);
  const conventions = [...ids]
    .map((eventId) => {
      const event = w.events.find((e) => e.id === eventId),
        allManual = chronologicalEntries(manual.filter((e) => e.eventId === eventId));
      const recordedSale =
        event?.status === 'accepted' ? recorded.find((r) => r.eventId === eventId) : undefined;
      const override = allManual.find((e) => e.mode === 'total'),
        visibleManual = allManual.filter(matches);
      const extras = visibleManual
          .filter((e) => e.mode !== 'total')
          .reduce((n, e) => n + e.amount, 0),
        manualTotal = override && matches(override) ? override.amount : 0;
      return {
        eventId,
        name: event?.name || allManual[0]?.conventionName || 'Removed convention',
        start:
          event?.start ||
          allManual.find((e) => e.conventionStart)?.conventionStart ||
          allManual[0]?.date ||
          '',
        end:
          event?.end ||
          allManual.find((e) => e.conventionEnd)?.conventionEnd ||
          allManual.find((e) => e.mode === 'total')?.date ||
          '',
        recorded: recordedSale?.total || 0,
        transactions: recordedSale?.transactions || 0,
        manual: manualTotal + extras,
        total: (override ? manualTotal : recordedSale?.total || 0) + extras,
        entries: visibleManual,
        source: override
          ? 'Manual total (' + override.date + ')' + (extras ? ' + extras' : '')
          : 'Recorded sales' + (extras ? ' + extras' : ''),
      };
    })
    .filter((e) => !year || e.start.slice(0, 4) === year || e.recorded || e.entries.length)
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.name.localeCompare(b.name) ||
        a.eventId.localeCompare(b.eventId),
    );
  const otherConvention = selected.filter(
    (e) =>
      e.type === 'earning' &&
      e.category === 'convention' &&
      !w.events.some((c) => c.id === e.eventId && c.status === 'accepted'),
  );
  const commissions = selected.filter((e) => e.type === 'earning' && e.category === 'commission'),
    creatorPrograms = selected.filter((e) => e.type === 'earning' && e.category === 'creator');
  const expenses = selected.filter((e) => e.type === 'expense'),
    expenseTotal = expenses.reduce((n, e) => n + e.amount, 0),
    conventionTotal = conventions.reduce((n, e) => n + e.total, 0),
    commissionTotal = commissions.reduce((n, e) => n + e.amount, 0),
    creatorTotal = creatorPrograms.reduce((n, e) => n + e.amount, 0),
    earningsTotal = conventionTotal + commissionTotal + creatorTotal;
  return {
    conventions,
    otherConvention,
    commissions,
    creatorPrograms,
    expenses,
    expenseTotal,
    conventionTotal,
    commissionTotal,
    creatorTotal,
    earningsTotal,
    net: earningsTotal - expenseTotal,
    expenseCategories: ['convention', 'inventory', 'setup'].map((category) => ({
      category,
      total: expenses.filter((e) => e.category === category).reduce((n, e) => n + e.amount, 0),
    })),
  };
}
