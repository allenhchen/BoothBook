import assert from 'node:assert/strict';
import { alphabeticalItems } from '../lib/item-groups.ts';
const items = [{ id: 'z', name: 'Zelda', categoryId: 'prints', fandom: '  Legend   of Zelda ' }, { id: 'c', name: 'Character 10', categoryId: 'prints', fandom: 'Arknights' }, { id: 'a', name: 'Character 2', categoryId: 'prints', fandom: ' arknights ' }, { id: 'u', name: 'Original design', categoryId: 'prints' }, { id: 'blank', name: 'Another design', categoryId: 'prints', fandom: '  ' }, { id: 'na', name: 'Untitled design', categoryId: 'prints', fandom: 'N/A' }, { id: 'l', name: 'Link', categoryId: 'prints', fandom: 'legend of zelda' }];
const before = structuredClone(items), sorted = alphabeticalItems(items);
assert.deepEqual(sorted.map(i => i.id), ['a', 'c', 'l', 'z', 'blank', 'u', 'na']);
assert.deepEqual(items, before);
assert.deepEqual(alphabeticalItems([]), []);
assert.deepEqual(alphabeticalItems(items.filter(i => i.name.toLowerCase().includes('link'))).map(i => i.id), ['l']);
console.log('Fandom grouping with alphabetical item ordering, normalized fandoms, and N/A passed.');
