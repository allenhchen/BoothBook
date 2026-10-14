import assert from 'node:assert/strict';
import { validDay, conventionDays, defaultSaleDay, saleDay, salesForDay, dailySummary } from '../lib/convention-days.ts';
const event = { id: 'con', name: 'Convention', start: '2026-12-31', end: '2027-01-02', status: 'accepted' };
assert.deepEqual(conventionDays(event), ['2026-12-31', '2027-01-01', '2027-01-02']);
assert.equal(validDay('2026-02-30'), false);
assert.equal(validDay('2028-02-29'), true);
assert.equal(validDay('2026-2-01'), false);
assert.equal(defaultSaleDay(event, '2027-01-01'), '2027-01-01');
assert.equal(defaultSaleDay(event, '2026-10-06'), '2026-12-31');
const line = { itemId: 'i', name: 'Foil', category: 'Prints / Foil', price: 4000, discount: 1000, deal: 'Discount' };
const sales = [{ id: 's1', eventId: 'con', date: '2027-01-02T01:00:00Z', saleDate: '2026-12-31', reference: '', lines: [line, line] },
{ id: 's2', eventId: 'con', date: '2027-01-01T23:59:00Z', reference: '', lines: [line] },
{ id: 's3', eventId: 'con', date: '2026-10-06T23:59:00Z', reference: '', lines: [line] },
{ id: 's4', eventId: 'other', date: '2027-01-01T23:59:00Z', reference: '', lines: [line] }];
assert.equal(saleDay(sales[0], event), '2026-12-31');
assert.equal(saleDay(sales[1], event), '2027-01-01');
assert.equal(saleDay(sales[2], event), '');
assert.equal(salesForDay(sales, event, '2026-12-31').length, 1);
assert.equal(salesForDay(sales, event, '').length, 3);
assert.equal(salesForDay(sales, event, 'unassigned').length, 1);
const summary = dailySummary(sales, event);
assert.equal(summary.length, 4);
assert.equal(summary[2].transactions, 0);
assert.equal(summary.reduce((n, d) => n + d.total, 0), 12000);
assert.equal(summary.reduce((n, d) => n + d.weighted, 0), 16);
assert.equal(dailySummary(sales.filter(s => s.id !== 's1'), event)[0].units, 0);
assert.equal(saleDay({ ...sales[0], saleDate: '2027-01-03' }, event), '');
console.log('Inclusive convention days, year/leap boundaries, backdated sales, legacy/unassigned grouping, zero-sale days, all-days totals and deletion passed.');
