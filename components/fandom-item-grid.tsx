'use client';
import type { Item } from '../lib/model';
import { fandomGroups } from '../lib/item-groups';
import { FandomBadge } from './fandom-badge';
export function FandomItemGrid({
  items,
  colors,
  onSelect,
  disabled,
  ariaLabel,
}: {
  items: Item[];
  colors: Record<string, number>;
  onSelect: (item: Item) => void;
  disabled?: (item: Item) => boolean;
  ariaLabel: (item: Item) => string;
}) {
  return (
    <div className="fandom-item-groups">
      {fandomGroups(items).map((group) => (
        <section className="fandom-item-group" key={group.id} aria-label={group.name}>
          <div className="fandom-grid-heading">
            <FandomBadge name={group.name} colors={colors} />
            <span>
              {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <div className="product-grid">
            {group.items.map((item) => (
              <button
                type="button"
                className="product-tile"
                key={item.id}
                disabled={disabled?.(item)}
                aria-label={ariaLabel(item)}
                onClick={() => onSelect(item)}
              >
                <strong>{item.name}</strong>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
