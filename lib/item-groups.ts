import type { Item } from './model';
const alphabetical = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || a.localeCompare(b);
export function alphabeticalItems(items: Item[]) {
  const fandom = (item: Item) => item.fandom?.trim().replace(/\s+/g, ' ').toLowerCase() || 'n/a';
  return items.slice().sort((a, b) =>
    alphabetical(fandom(a), fandom(b)) || alphabetical(a.name, b.name) || a.id.localeCompare(b.id),
  );
}
