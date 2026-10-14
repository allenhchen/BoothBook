import type { Item } from './model';
const alphabetical = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) || a.localeCompare(b);
export function fandomGroups(items: Item[]) {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      items: Item[];
    }
  >();
  for (const item of items
    .slice()
    .sort((a, b) => alphabetical(a.name, b.name) || a.id.localeCompare(b.id))) {
    const name = item.fandom?.trim().replace(/\s+/g, ' ') || 'N/A',
      key = name.toLocaleLowerCase('en-US');
    if (!groups.has(key)) groups.set(key, { id: key, name, items: [] });
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()].sort((a, b) => alphabetical(a.name, b.name));
}
