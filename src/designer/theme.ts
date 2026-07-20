import type { ThemeConfig } from '../types.js';

/**
 * ThemeConfig → --tk-* CSS custom properties (Charter §7.3, docs/design-reference §3).
 * Defaults are the Charter values; partners override via init `theme` and/or ordinary host CSS on
 * the documented tk- classes (docs/02 §3). Vars are set on the overlay root so host CSS can still
 * out-cascade them.
 */

export const THEME_DEFAULTS: Required<Omit<ThemeConfig, 'logo'>> & { logo: string | false } = {
  primary: '#8EA0F6', // brand periwinkle
  accent: '#EA8D00', // brand orange
  headerBackground: '#F26B1D', // Riley's channel orange
  headerText: '#ffffff',
  surface: '#ffffff',
  borderRadius: '15px',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  overlayColor: 'rgba(0, 0, 0, 0.55)',
  zIndex: 2147483000,
  logo: false,
};

const VAR_BY_KEY: Record<string, string> = {
  primary: '--tk-primary',
  accent: '--tk-accent',
  headerBackground: '--tk-header-background',
  headerText: '--tk-header-text',
  surface: '--tk-surface',
  borderRadius: '--tk-border-radius',
  fontFamily: '--tk-font-family',
  overlayColor: '--tk-overlay-color',
  zIndex: '--tk-z-index',
};

export function resolveTheme(overrides: ThemeConfig): typeof THEME_DEFAULTS {
  return { ...THEME_DEFAULTS, ...overrides };
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
