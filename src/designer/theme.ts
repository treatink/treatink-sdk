import type { ThemeConfig } from '../types.js';

/**
 * ThemeConfig → --tk-* CSS custom properties (docs/13 §1, VP-01).
 * Defaults are the EXACT store palette (../treatink/web/src/index.css:48-67), not the Charter §7.3
 * values. Derived tokens resolve explicit-wins: an explicitly set token is used verbatim; an
 * omitted derived token whose BASE was overridden is computed from the base (color-mix()/min()
 * expressions — evaluated by the browser) so a partner overriding only primary/accent/borderRadius
 * still gets a coherent palette. Untouched tokens keep the exact store hexes.
 * Vars are set on the overlay root so host CSS can still out-cascade them (docs/02 §3).
 */

export const THEME_DEFAULTS: Required<Omit<ThemeConfig, 'logo'>> & { logo: string | false } = {
  primary: '#a99cdf', // store --purple
  primaryStrong: '#8c7ec2', // store --purple-darker
  panelBackground: '#e2e6ff', // store --purple-light
  accent: '#ffa518', // store --orange
  accentHover: '#dd9133', // store --orange-hover
  headerBackground: '#F26B1D', // SDK modal chrome (Charter §7.3, VP-04)
  headerText: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#F6F6FC', // store --purple-extra-light
  borderRadius: '20px', // cards (store rounded-20)
  buttonRadius: '15px', // filled buttons (store Button.scss)
  controlRadius: '10px', // chips/thumbs/inputs (store rounded-10)
  fontFamily: "'Montserrat', system-ui, sans-serif",
  overlayColor: 'rgba(0, 0, 0, 0.55)',
  zIndex: 2147483000,
  logo: false,
};

/** derived token → [its base token, derive(baseValue)] (docs/13 §1 resolution rule). */
const DERIVED: ReadonlyArray<[keyof ThemeConfig, keyof ThemeConfig, (base: string) => string]> = [
  ['primaryStrong', 'primary', (p) => `color-mix(in srgb, ${p} 80%, #000000)`],
  ['panelBackground', 'primary', (p) => `color-mix(in srgb, ${p} 20%, #ffffff)`],
  ['surfaceAlt', 'primary', (p) => `color-mix(in srgb, ${p} 6%, #ffffff)`],
  ['accentHover', 'accent', (a) => `color-mix(in srgb, ${a} 88%, #000000)`],
  ['buttonRadius', 'borderRadius', (r) => `min(${r}, 15px)`],
  ['controlRadius', 'borderRadius', (r) => `min(${r}, 10px)`],
];

const VAR_BY_KEY: Record<string, string> = {
  primary: '--tk-primary',
  primaryStrong: '--tk-primary-strong',
  panelBackground: '--tk-panel',
  accent: '--tk-accent',
  accentHover: '--tk-accent-hover',
  headerBackground: '--tk-header-background',
  headerText: '--tk-header-text',
  surface: '--tk-surface',
  surfaceAlt: '--tk-surface-alt',
  borderRadius: '--tk-border-radius',
  buttonRadius: '--tk-radius-button',
  controlRadius: '--tk-radius-control',
  fontFamily: '--tk-font-family',
  overlayColor: '--tk-overlay-color',
  zIndex: '--tk-z-index',
};

export function resolveTheme(overrides: ThemeConfig): typeof THEME_DEFAULTS {
  const resolved = { ...THEME_DEFAULTS, ...overrides };
  for (const [derived, base, derive] of DERIVED) {
    if (overrides[derived] === undefined && overrides[base] !== undefined) {
      (resolved as Record<string, unknown>)[derived] = derive(String(overrides[base]));
    }
  }
  return resolved;
}

/** Stamp the resolved theme onto the overlay root as CSS variables. */
export function applyTheme(root: HTMLElement, theme: typeof THEME_DEFAULTS): void {
  for (const [key, cssVar] of Object.entries(VAR_BY_KEY)) {
    const value = theme[key as keyof typeof theme];
    if (value !== undefined && value !== false) {
      root.style.setProperty(cssVar, String(value));
    }
  }
}
