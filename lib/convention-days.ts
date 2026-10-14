import type { Event, Sale } from './model';
export function validDay(day: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day + 'T00:00:00Z')) &&
    new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day
  );
}
export function conventionDays(event: Event) {
  if (!validDay(event.start) || !validDay(event.end) || event.end < event.start) return [];
  const result: string[] = [];
  const last = Date.parse(event.end + 'T00:00:00Z');
  for (let ms = Date.parse(event.start + 'T00:00:00Z'); ms <= last; ms += 86400000)
    result.push(new Date(ms).toISOString().slice(0, 10));
  return result;
}
export function defaultSaleDay(event: Event, today: string) {
  return validDay(today) && today >= event.start && today <= event.end ? today : event.start;
}
/** Older sales retain their recorded UTC day when it fits; never invent a day. */
export function saleDay(sale: Sale, event: Event) {
  const day = sale.saleDate || sale.date.slice(0, 10);
  return validDay(day) && day >= event.start && day <= event.end ? day : '';
}
export function salesForDay(sales: Sale[], event: Event, day: string) {
  return sales.filter(
    (s) =>
      s.eventId === event.id && (!day || saleDay(s, event) === (day === 'unassigned' ? '' : day)),
  );
}
export function dailySummary(sales: Sale[], event: Event) {
  const selected = sales.filter((s) => s.eventId === event.id),
    days = conventionDays(event);
  if (selected.some((s) => !saleDay(s, event))) days.push('unassigned');
  return days.map((day) => {
    const transactions = salesForDay(selected, event, day),
      lines = transactions.flatMap((s) => s.lines);
    const gross = lines.reduce((n, l) => n + l.price, 0),
      discount = lines.reduce((n, l) => n + l.discount, 0);
    return {
      day,
      transactions: transactions.length,
      units: lines.length,
      gross,
      discount,
      total: gross - discount,
      weighted: gross / 1000,
    };
  });
}
