import { describe, expect, it } from 'vitest';

import { applyTheme, resolveTheme, THEME_DEFAULTS } from './theme.js';

describe('theme resolution (docs/13 §1, VP-01)', () => {
  it('defaults are the exact store palette, not the Charter values', () => {
    expect(THEME_DEFAULTS.primary).toBe('#a99cdf'); // store --purple
    expect(THEME_DEFAULTS.primaryStrong).toBe('#8c7ec2'); // store --purple-darker
    expect(THEME_DEFAULTS.panelBackground).toBe('#e2e6ff'); // store --purple-light
    expect(THEME_DEFAULTS.accent).toBe('#ffa518'); // store --orange
    expect(THEME_DEFAULTS.accentHover).toBe('#dd9133'); // store --orange-hover
    expect(THEME_DEFAULTS.surfaceAlt).toBe('#F6F6FC'); // store --purple-extra-light
    expect(THEME_DEFAULTS.borderRadius).toBe('20px');
    expect(THEME_DEFAULTS.buttonRadius).toBe('15px');
    expect(THEME_DEFAULTS.controlRadius).toBe('10px');
    expect(THEME_DEFAULTS.headerBackground).toBe('#F26B1D'); // SDK chrome (VP-04)
  });

  it('no overrides → defaults pass through untouched (no derivation)', () => {
    expect(resolveTheme({})).toEqual(THEME_DEFAULTS);
  });

  it('an explicitly set derived token wins over derivation', () => {
    const theme = resolveTheme({ primary: '#336699', primaryStrong: '#112233' });
    expect(theme.primaryStrong).toBe('#112233');
  });

  it('overriding only a base token derives its dependent shades', () => {
    const theme = resolveTheme({ primary: '#336699', accent: '#cc0000' });
    expect(theme.primaryStrong).toBe('color-mix(in srgb, #336699 80%, #000000)');
    expect(theme.panelBackground).toBe('color-mix(in srgb, #336699 20%, #ffffff)');
    expect(theme.surfaceAlt).toBe('color-mix(in srgb, #336699 6%, #ffffff)');
    expect(theme.accentHover).toBe('color-mix(in srgb, #cc0000 88%, #000000)');
    // Radii were NOT overridden → exact defaults, not derived expressions.
    expect(theme.buttonRadius).toBe('15px');
    expect(theme.controlRadius).toBe('10px');
  });

  it('overriding borderRadius steps the button/control radii down via min()', () => {
    const theme = resolveTheme({ borderRadius: '8px' });
    expect(theme.buttonRadius).toBe('min(8px, 15px)');
    expect(theme.controlRadius).toBe('min(8px, 10px)');
  });

  it('applyTheme stamps every token as a --tk-* var on the root', () => {
    const set = new Map<string, string>();
    const root = {
      style: { setProperty: (name: string, value: string) => set.set(name, value) },
    } as unknown as HTMLElement;
    applyTheme(root, resolveTheme({}));
    expect(set.get('--tk-primary')).toBe('#a99cdf');
    expect(set.get('--tk-primary-strong')).toBe('#8c7ec2');
    expect(set.get('--tk-panel')).toBe('#e2e6ff');
    expect(set.get('--tk-accent')).toBe('#ffa518');
    expect(set.get('--tk-accent-hover')).toBe('#dd9133');
    expect(set.get('--tk-surface-alt')).toBe('#F6F6FC');
    expect(set.get('--tk-border-radius')).toBe('20px');
    expect(set.get('--tk-radius-button')).toBe('15px');
    expect(set.get('--tk-radius-control')).toBe('10px');
    expect(set.get('--tk-z-index')).toBe('2147483000');
    // logo:false must not stamp a var
    expect([...set.keys()].some((k) => k.includes('logo'))).toBe(false);
  });
});
