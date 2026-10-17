import type { Item } from './model';
const alphabetical = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || a.localeCompare(b);
export function alphabeticalItems(items: Item[]) {
  return items.slice().sort((a, b) => alphabetical(a.name, b.name) || a.id.localeCompare(b.id));
}
