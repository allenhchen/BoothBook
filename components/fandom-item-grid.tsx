'use client';
import type { Item } from '../lib/model';
import { fandomItemGroups } from '../lib/item-groups';
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
    <div className="fandom-group-grid">
      {fandomItemGroups(items).map((group) => (
        <section className="fandom-group-box" key={group.name.toLowerCase()} aria-label={group.name}>
          <h5>
            <FandomBadge name={group.name} colors={colors} />
          </h5>
          <div className="fandom-group-items">
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
