/**
 * Inline UI icons (docs/13 §7 — zero runtime deps, I-08): the lucide stroke paths the store uses
 * via lucide-react, built with createElementNS — no innerHTML (docs/11 §3). Icons are decorative
 * (aria-hidden); their buttons carry the accessible labels.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** name → path `d` list (lucide 24×24 stroke icons, as rendered by the store components). */
const ICON_PATHS: Record<string, string[]> = {
  'rotate-ccw': ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
  'rotate-cw': ['M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5'],
  trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
  'chevron-up': ['m18 15-6-6-6 6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z', 'm21 21-4.3-4.3'],
};

export type IconName = keyof typeof ICON_PATHS;

export function createIcon(doc: Document, name: IconName, size = 20): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ICON_PATHS[name] ?? []) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}
