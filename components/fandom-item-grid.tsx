'use client';
import type { Item } from '../lib/model';
import { alphabeticalItems } from '../lib/item-groups';
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
    <div className="product-grid">
      {alphabeticalItems(items).map((item) => (
        <button
          type="button"
          className="product-tile"
          key={item.id}
          disabled={disabled?.(item)}
          aria-label={ariaLabel(item)}
          onClick={() => onSelect(item)}
        >
          <strong>{item.name}</strong>
          <FandomBadge name={item.fandom || ''} colors={colors} iconOnly />
        </button>
      ))}
    </div>
  );
}
