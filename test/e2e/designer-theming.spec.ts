import { expect, test, type Page } from '@playwright/test';
import { MOBILE_BREAKPOINT_PX } from '../../src/designer/styles.js';
import type { Treatink } from '../../src/types.js';

/** The mobile sheet is intentionally square-cornered (full-screen media query). */
function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize();
  return viewport !== null && viewport.width < MOBILE_BREAKPOINT_PX;
}

// P2-T04 (+P5-T02): init theme/copy change the rendered modal; host CSS on tk- classes overrides
// cleanly; default theme matches the STORE palette (docs/13 §1, VP-01 — supersedes Charter §7.3).

declare global {
  interface Window {
    tk: Treatink;
    Treatink: { init: (config: unknown) => Treatink };
    __events: Array<{ event: string; payload: unknown }>;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
});

test('default theme matches the store palette (docs/13 §1)', async ({ page }) => {
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  // header renders the SDK-chrome orange default (VP-04)
  await expect(page.locator('.tk-header')).toHaveCSS('background-color', 'rgb(242, 107, 29)');
  const vars = await page.locator('.tk-overlay').evaluate((el) => ({
    primary: el.style.getPropertyValue('--tk-primary'),
    primaryStrong: el.style.getPropertyValue('--tk-primary-strong'),
    panel: el.style.getPropertyValue('--tk-panel'),
    accent: el.style.getPropertyValue('--tk-accent'),
    accentHover: el.style.getPropertyValue('--tk-accent-hover'),
    surfaceAlt: el.style.getPropertyValue('--tk-surface-alt'),
    radius: el.style.getPropertyValue('--tk-border-radius'),
    radiusButton: el.style.getPropertyValue('--tk-radius-button'),
    radiusControl: el.style.getPropertyValue('--tk-radius-control'),
    z: el.style.getPropertyValue('--tk-z-index'),
  }));
  expect(vars).toEqual({
    primary: '#a99cdf', // store --purple
    primaryStrong: '#8c7ec2', // store --purple-darker
    panel: '#e2e6ff', // store --purple-light
    accent: '#ffa518', // store --orange
    accentHover: '#dd9133', // store --orange-hover
    surfaceAlt: '#F6F6FC', // store --purple-extra-light
    radius: '20px',
    radiusButton: '15px',
    radiusControl: '10px',
    z: '2147483000',
  });
  if (!isMobileViewport(page)) {
    await expect(page.locator('.tk-modal')).toHaveCSS('border-radius', '20px');
  }
});

test('overriding only base tokens derives the dependent shades (docs/13 §1)', async ({ page }) => {
  await page.evaluate(() => {
    const custom = window.Treatink.init({
      apiKey: 'pk_test_custom',
      channel: 'other.example',
      theme: { primary: '#336699', accent: '#cc0000' },
    });
    custom.designer.open({ sku: 'SSGTTBC' });
  });
  await expect(page.locator('.tk-modal')).toBeVisible();
  const vars = await page.locator('.tk-overlay').evaluate((el) => ({
    primaryStrong: el.style.getPropertyValue('--tk-primary-strong'),
    accentHover: el.style.getPropertyValue('--tk-accent-hover'),
  }));
  expect(vars.primaryStrong).toBe('color-mix(in srgb, #336699 80%, #000000)');
  expect(vars.accentHover).toBe('color-mix(in srgb, #cc0000 88%, #000000)');
});

test('init theme + copy overrides change the rendered modal', async ({ page }) => {
  await page.evaluate(() => {
    const custom = window.Treatink.init({
      apiKey: 'pk_test_custom',
      channel: 'other.example',
      theme: { headerBackground: '#123456', headerText: '#ffee00', borderRadius: '2px' },
      copy: { headerTitle: 'Make It Yours', closeLabel: 'Dismiss' },
    });
    custom.designer.open({ sku: 'SSGTTBC' });
  });
  await expect(page.locator('.tk-modal')).toBeVisible();
  await expect(page.locator('.tk-title')).toHaveText('Make It Yours');
  await expect(page.locator('.tk-close')).toHaveAttribute('aria-label', 'Dismiss');
  await expect(page.locator('.tk-header')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await expect(page.locator('.tk-header')).toHaveCSS('color', 'rgb(255, 238, 0)');
  if (!isMobileViewport(page)) {
    await expect(page.locator('.tk-modal')).toHaveCSS('border-radius', '2px');
  }
});

test('ordinary host CSS on documented tk- classes overrides cleanly', async ({ page }) => {
  await page.addStyleTag({ content: '.tk-header { background: rgb(9, 9, 9) !important; }' });
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  await expect(page.locator('.tk-header')).toHaveCSS('background-color', 'rgb(9, 9, 9)');
});
