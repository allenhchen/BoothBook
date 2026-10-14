'use client';
import { FandomItemGrid } from './fandom-item-grid';
import { money, orderedCategories, type Workspace, type Item } from '../lib/model';
export function CategoryItemGrid({ w, rootId, items, colors, disabled, onSelect, ariaLabel }: {
  w: Workspace;
  rootId: string;
  items: Item[];
  colors: Record<string, number>;
  disabled: (item: Item) => boolean;
  onSelect: (item: Item) => void;
  ariaLabel: (item: Item) => string;
}) {
  const categories = orderedCategories(w.categories).filter(c => items.some(i => i.categoryId === c.id));
  const sections = [...categories.map(c => ({ id: c.id, name: c.name, price: c.price, items: items.filter(i => i.categoryId === c.id) })), ...(items.some(i => !w.categories.some(c => c.id === i.categoryId)) ? [{ id: '__uncategorized__', name: 'N/A', price: null, items: items.filter(i => !w.categories.some(c => c.id === i.categoryId)) }] : [])];
  return <div className="catalog-button-groups">{sections.map(section => <section className="catalog-button-section" key={section.id}>{section.id !== rootId && <h4>{section.name}<span className="category-price">{section.id === '__uncategorized__' ? '' : section.price === null ? 'Set price' : money(section.price)}</span>
  </h4>}<FandomItemGrid items={section.items} colors={colors} disabled={disabled} ariaLabel={ariaLabel} onSelect={onSelect} />
  </section>)}</div>;
}
