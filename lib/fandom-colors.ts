import type { Workspace } from './model';
export const fandomKey = (name: string) =>
  name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
function hash(name: string) {
  let value = 2166136261;
  for (const c of name) value = Math.imul(value ^ c.charCodeAt(0), 16777619);
  return value >>> 0;
}
const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
/** Preserve existing assignments; add the hue furthest from all assigned hues. */
export function assignFandomColors(names: string[], existing: Record<string, number> = {}) {
  const colors: Record<string, number> = Object.create(null);
  for (const [key, hue] of Object.entries(existing))
    if (Number.isInteger(hue) && hue >= 0 && hue < 360) colors[fandomKey(key)] = hue;
  for (const key of [...new Set(names.map(fandomKey))].filter((k) => k && k !== 'n/a').sort()) {
    if (Object.hasOwn(colors, key)) continue;
    const preferred = hash(key) % 360,
      used = [...new Set(Object.values(colors))].sort((a, b) => a - b);
    let best = preferred,
      score = -1;
    // A furthest hue lies at a midpoint of a gap; no full palette search needed.
    for (let i = 0; i < used.length; i++) {
      const gap = (used[(i + 1) % used.length] - used[i] + 360) % 360 || 360;
      for (const step of [Math.floor(gap / 2), Math.ceil(gap / 2)]) {
        const hue = (used[i] + step) % 360,
          current = Math.floor(gap / 2);
        if (
          current > score ||
          (current === score && distance(hue, preferred) < distance(best, preferred))
        ) {
          score = current;
          best = hue;
        }
      }
    }
    colors[key] = best;
  }
  return colors;
}
export function workspaceFandomColors(w: Workspace) {
  const catalog = assignFandomColors(
    w.items.map((i) => i.fandom || ''),
    w.fandomColors,
  );
  return assignFandomColors(
    w.sales.flatMap((s) => s.lines.map((l) => l.fandom || '')),
    catalog,
  );
}
