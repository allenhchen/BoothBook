import type { CSSProperties } from 'react';
import { fandomKey } from '../lib/fandom-colors';
export function FandomBadge({ name, colors, iconOnly = false }: { name: string; colors: Record<string, number>; iconOnly?: boolean }) {
  const text = name.trim() || 'N/A',
    hue = colors[fandomKey(text)];
  return (
    <span
      className={'fandom-badge' + (hue === undefined ? ' fandom-neutral' : '') + (iconOnly ? ' fandom-icon' : '')}
      title={iconOnly ? text : undefined}
      aria-label={iconOnly ? text : undefined}
      style={hue === undefined ? undefined : ({ '--fandom-hue': hue } as CSSProperties)}
    >
      {iconOnly ? text.split(/\s+/).map((word) => Array.from(word)[0]).slice(0, 2).join('').toLocaleUpperCase() : text}
    </span>
  );
}
