export type Category = {
  id: string;
  name: string;
  parentId: string | null;
  price: number | null;
};
export type Item = {
  id: string;
  name: string;
  categoryId: string | null;
  fandom?: string;
};
export type Deal = {
  id: string;
  name: string;
  buy: number;
  free: number;
  kind?: 'free' | 'amount' | 'percent';
  discountValue?: number;
  categoryIds: string[];
  itemIds: string[];
};
export type Event = {
  id: string;
  name: string;
  start: string;
  end: string;
  status: 'awaiting' | 'rejected' | 'waitlisted' | 'accepted';
};
export type Unit = {
  id: string;
  itemId: string;
  poolId: string;
};
export type Pool = {
  id: string;
  dealId: string;
};
export type Sale = {
  id: string;
  eventId: string;
  date: string;
  saleDate?: string;
  reference: string;
  manualDiscount?: ManualDiscount;
  lines: {
    itemId: string;
    name: string;
    fandom?: string;
    category: string;
    price: number;
    discount: number;
    deal: string;
  }[];
};
export type Workspace = {
  artTasks?: ArtTask[];
  categories: Category[];
  items: Item[];
  deals: Deal[];
  events: Event[];
  sales: Sale[];
  fandomColors?: Record<string, number>;
  finance?: import('./finance').FinanceEntry[];
};
export type ArtTask = {
  id: string;
  name: string;
  start: string;
  deadline: string;
  status: 'planned' | 'in-progress' | 'completed';
  notes: string;
};
export const seed: Workspace = {
  categories: [
    { id: 'prints', name: 'Prints', parentId: null, price: null },
    { id: 'mini', name: 'Mini prints', parentId: 'prints', price: 1500 },
    { id: 'standard', name: 'Standard prints', parentId: 'prints', price: 2500 },
    { id: 'foil', name: 'Foil prints', parentId: 'prints', price: 4000 },
    { id: 'standees', name: 'Standees', parentId: null, price: null },
    { id: 'multi', name: 'Multi-layer', parentId: 'standees', price: 3500 },
    { id: 'charms', name: 'Charms', parentId: null, price: 1000 },
  ],
  items: ['The Proclamation', 'The Nephilim', 'The Cambion', 'The Warden', 'The Archivist']
    .flatMap((name, i) =>
      ['mini', 'standard', 'foil'].map((categoryId) => ({
        id: `design-${i}-${categoryId}`,
        name,
        categoryId,
      })),
    )
    .concat([
      { id: 'standee-1', name: 'The Proclamation', categoryId: 'multi' },
      { id: 'charm-1', name: 'The Cambion', categoryId: 'charms' },
    ]),
  deals: [
    { id: 'b2g1', name: 'Buy 2 get 1', buy: 2, free: 1, categoryIds: ['prints'], itemIds: [] },
    { id: 'b3g2', name: 'Buy 3 get 2', buy: 3, free: 2, categoryIds: ['prints'], itemIds: [] },
  ],
  events: [
    {
      id: 'demo-event',
      name: 'Practice convention',
      start: '2026-10-06',
      end: '2026-10-08',
      status: 'accepted',
    },
  ],
  sales: [],
};
export const money = (c: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);
export function path(w: Workspace, id: string | null): Category[] {
  const out: Category[] = [];
  let c = w.categories.find((c) => c.id === id);
  while (c && !out.some((x) => x.id === c!.id)) {
    out.unshift(c);
    c = w.categories.find((x) => x.id === c!.parentId);
  }
  return out;
}
export function eligible(w: Workspace, item: Item, deal: Deal) {
  return path(w, item.categoryId).some((c) => deal.categoryIds.includes(c.id));
}
export type ManualDiscount = {
  kind: 'amount' | 'percent';
  value: number;
};
export function calculate(w: Workspace, units: Unit[], pools: Pool[], manual?: ManualDiscount) {
  const lines = units.map((u) => {
    const item = w.items.find((i) => i.id === u.itemId);
    if (!item) throw Error('An item no longer exists.');
    const c = w.categories.find((c) => c.id === item.categoryId);
    if (!c || w.categories.some((x) => x.parentId === c.id) || c.price === null)
      throw Error('Set a price on the lowest category before checkout.');
    return {
      ...u,
      name: item.name,
      fandom: item.fandom || '',
      category: path(w, c.id)
        .map((x) => x.name)
        .join(' / '),
      price: c.price,
      discount: 0,
      deal: '',
    };
  });
  for (const pool of pools) {
    const d = w.deals.find((d) => d.id === pool.dealId);
    if (!d) throw Error('Choose a deal for each pool.');
    const members = lines.filter((l) => l.poolId === pool.id);
    if (members.some((l) => !eligible(w, w.items.find((i) => i.id === l.itemId)!, d)))
      throw Error(`Some items are not eligible for ${d.name}.`);
    if (!d.kind || d.kind === 'free') {
      const freeCount = Math.floor(members.length / (d.buy + d.free)) * d.free;
      members
        .sort((a, b) => a.price - b.price || a.id.localeCompare(b.id))
        .slice(0, freeCount)
        .forEach((l) => (l.discount = l.price));
    } else {
      const sorted = members.slice().sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
      for (let n = 0; n + d.buy <= sorted.length; n += d.buy) {
        const group = sorted.slice(n, n + d.buy),
          sum = group.reduce((v, l) => v + l.price, 0);
        const discount = Math.min(
          sum,
          d.kind === 'amount'
            ? d.discountValue || 0
            : Math.round((sum * (d.discountValue || 0)) / 100),
        );
        let remaining = discount;
        group.forEach((l, i) => {
          l.discount =
            i === group.length - 1 ? remaining : sum ? Math.floor((discount * l.price) / sum) : 0;
          remaining -= l.discount;
        });
      }
    }
    members.forEach((l) => (l.deal = d.name));
  }
  if (lines.some((l) => l.poolId && !pools.some((p) => p.id === l.poolId)))
    throw Error('A deal pool no longer exists.');
  const dealDiscount = lines.reduce((sum, l) => sum + l.discount, 0);
  let manualDiscount = 0;
  if (manual) {
    if (
      !Number.isFinite(manual.value) ||
      manual.value < 0 ||
      (manual.kind === 'percent' && manual.value > 100) ||
      (manual.kind === 'amount' && !Number.isInteger(manual.value))
    )
      throw Error('Enter a valid custom discount.');
    const remainingTotal = lines.reduce((sum, l) => sum + l.price - l.discount, 0);
    manualDiscount = Math.min(
      remainingTotal,
      manual.kind === 'amount' ? manual.value : Math.round((remainingTotal * manual.value) / 100),
    );
    let remainder = manualDiscount;
    const paid = lines.filter((l) => l.price > l.discount);
    paid.forEach((l, n) => {
      const share =
        n === paid.length - 1
          ? remainder
          : Math.floor((manualDiscount * (l.price - l.discount)) / remainingTotal);
      l.discount += share;
      remainder -= share;
    });
  }
  return {
    dealDiscount,
    manualDiscount,
    lines,
    gross: lines.reduce((a, l) => a + l.price, 0),
    discount: lines.reduce((a, l) => a + l.discount, 0),
    total: lines.reduce((a, l) => a + l.price - l.discount, 0),
  };
}
export function removeCategory(w: Workspace, id: string): Workspace {
  const removed = new Set(
    w.categories.filter((c) => path(w, c.id).some((p) => p.id === id)).map((c) => c.id),
  );
  return {
    ...w,
    categories: w.categories.filter((c) => !removed.has(c.id)),
    items: w.items.map((i) =>
      i.categoryId && removed.has(i.categoryId) ? { ...i, categoryId: null } : i,
    ),
    deals: w.deals.map((d) => ({
      ...d,
      categoryIds: d.categoryIds.filter((c) => !removed.has(c)),
    })),
  };
}
export function removeItem(w: Workspace, id: string): Workspace {
  return {
    ...w,
    items: w.items.filter((i) => i.id !== id),
    deals: w.deals.map((d) => ({ ...d, itemIds: d.itemIds.filter((i) => i !== id) })),
  };
}
/** Display parents immediately followed by their descendants, regardless of creation order. */
export function orderedCategories(categories: Category[]): Category[] {
  const sorted = categories
    .slice()
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
        a.id.localeCompare(b.id),
    );
  const result: Category[] = [],
    seen = new Set<string>();
  function visit(c: Category) {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    result.push(c);
    sorted.filter((child) => child.parentId === c.id).forEach(visit);
  }
  sorted.filter((c) => c.parentId === null).forEach(visit);
  sorted.forEach(visit);
  return result;
}
/** Parent groups preserve the caller's item sorting, including N/A items. */
export function catalogGroups(w: Workspace, items: Item[]) {
  const groups = orderedCategories(w.categories)
    .filter((c) => !c.parentId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: items.filter((i) => path(w, i.categoryId)[0]?.id === c.id),
    }));
  const unassigned = items.filter((i) => !path(w, i.categoryId).length);
  if (unassigned.length) groups.push({ id: '__uncategorized__', name: 'N/A', items: unassigned });
  return groups.filter((g) => g.items.length);
}
export function validCategoryDepth(categories: Category[]) {
  return categories.every(
    (c) => !c.parentId || categories.some((p) => p.id === c.parentId && p.parentId === null),
  );
}
export function sortedItems(
  w: Workspace,
  items: Item[],
  column: 'name' | 'category' | 'price' | 'fandom',
  direction: number,
) {
  return items.slice().sort((a, b) => {
    const value = (i: Item) =>
      column === 'name'
        ? i.name
        : column === 'fandom'
          ? i.fandom || 'N/A'
          : column === 'category'
            ? path(w, i.categoryId)
                .map((c) => c.name)
                .join(' / ') || 'N/A'
            : (w.categories.find((c) => c.id === i.categoryId)?.price ?? -1);
    const av = value(a),
      bv = value(b);
    return (
      direction *
        (typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, {
              numeric: true,
              sensitivity: 'base',
            })) ||
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) ||
      a.id.localeCompare(b.id)
    );
  });
}
export function assignUnit(
  w: Workspace,
  units: Unit[],
  pools: Pool[],
  unitId: string,
  poolId: string,
): Unit[] {
  const unit = units.find((u) => u.id === unitId),
    item = w.items.find((i) => i.id === unit?.itemId),
    pool = pools.find((p) => p.id === poolId),
    deal = w.deals.find((d) => d.id === pool?.dealId);
  if (poolId && (!item || !deal || !eligible(w, item, deal)))
    throw Error('This item is not eligible for that deal.');
  return units.map((u) => (u.id === unitId ? { ...u, poolId } : u));
}
export function salesGroups(w: Workspace, lines: Sale['lines']) {
  const labels = Array.from(
    new Set([
      ...orderedCategories(w.categories)
        .filter((c) => !w.categories.some((x) => x.parentId === c.id))
        .map((c) =>
          path(w, c.id)
            .map((x) => x.name)
            .join(' / '),
        ),
      ...lines.map((l) => l.category),
    ]),
  );
  const roots = Array.from(new Set(labels.map((label) => label.split(' / ')[0])));
  return roots.map((root) => {
    const columns = labels.filter((label) => label.split(' / ')[0] === root),
      members = lines.filter((l) => columns.includes(l.category)),
      names = Array.from(
        new Set([
          ...w.items.filter((i) => path(w, i.categoryId)[0]?.name === root).map((i) => i.name),
          ...members.map((l) => l.name),
        ]),
      );
    const fandoms = Object.fromEntries(
      names.map((name) => {
        const sold = members.filter((l) => l.name === name);
        const values = sold.length
          ? sold.map((l) => l.fandom ?? w.items.find((i) => i.id === l.itemId)?.fandom ?? '')
          : w.items
              .filter((i) => i.name === name && path(w, i.categoryId)[0]?.name === root)
              .map((i) => i.fandom || '');
        return [
          name,
          Array.from(new Set(values.map((v) => v || 'N/A')))
            .sort()
            .join(', ') || 'N/A',
        ];
      }),
    );
    return { root, columns, lines: members, names, fandoms };
  });
}
export function purchasedItems(sale: Sale) {
  const grouped = new Map<
    string,
    {
      name: string;
      category: string;
      quantity: number;
    }
  >();
  for (const line of sale.lines) {
    const key = JSON.stringify([line.name, line.category]);
    const entry = grouped.get(key) || { name: line.name, category: line.category, quantity: 0 };
    entry.quantity++;
    grouped.set(key, entry);
  }
  return Array.from(grouped.values());
}
export function removeDeal(w: Workspace, pools: Pool[], units: Unit[], id: string) {
  const removed = new Set(pools.filter((p) => p.dealId === id).map((p) => p.id));
  return {
    workspace: { ...w, deals: w.deals.filter((d) => d.id !== id) },
    pools: pools.filter((p) => !removed.has(p.id)),
    units: units.map((u) => (removed.has(u.poolId) ? { ...u, poolId: '' } : u)),
  };
}
export function weightedSales(lines: Sale['lines']) {
  return lines.reduce((sum, line) => sum + line.price, 0) / 1000;
}
export function eventsForYear(events: Event[], year: string) {
  return events
    .filter((e) => !year || e.start.slice(0, 4) === year)
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
}
export function sortSalesNames(
  group: ReturnType<typeof salesGroups>[number],
  column: string,
  direction: number,
) {
  return group.names.slice().sort((a, b) => {
    const value = (name: string) => {
      const lines = group.lines.filter((l) => l.name === name);
      return column === 'name'
        ? name
        : column === 'fandom'
          ? group.fandoms[name]
          : column === 'weighted'
            ? weightedSales(lines)
            : column === 'units'
              ? lines.length
              : lines.filter((l) => l.category === column).length;
    };
    const av = value(a),
      bv = value(b);
    return (
      direction *
        (typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, {
              numeric: true,
              sensitivity: 'base',
            })) || a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  });
}
export function sortedSales(sales: Sale[], column: string, direction: number) {
  return sales.slice().sort((a, b) => {
    const value = (s: Sale) =>
      column === 'saleDate'
        ? s.saleDate || s.date.slice(0, 10)
        : column === 'date'
          ? s.date
          : column === 'items'
            ? purchasedItems(s)
                .map((i) => i.name)
                .join(', ')
            : column === 'deals'
              ? Array.from(new Set(s.lines.map((l) => l.deal))).join(', ')
              : column === 'reference'
                ? s.reference
                : s.lines.reduce((sum, l) => sum + l.price - l.discount, 0);
    const av = value(a),
      bv = value(b);
    return (
      direction *
        (typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, {
              numeric: true,
              sensitivity: 'base',
            })) || a.id.localeCompare(b.id)
    );
  });
}
