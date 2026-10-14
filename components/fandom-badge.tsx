import type { CSSProperties } from 'react';
import { fandomKey } from '../lib/fandom-colors';
export function FandomBadge({ name, colors }: { name: string; colors: Record<string, number> }) {
  const text = name.trim() || 'N/A',
    hue = colors[fandomKey(text)];
  return (
    <span
      className={'fandom-badge' + (hue === undefined ? ' fandom-neutral' : '')}
      style={hue === undefined ? undefined : ({ '--fandom-hue': hue } as CSSProperties)}
    >
      {text}
    </span>
  );
}
