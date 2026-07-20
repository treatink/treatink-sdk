import { expect, test, type Page } from '@playwright/test';
import { MOBILE_BREAKPOINT_PX } from '../../src/designer/styles.js';
import type { Treatink } from '../../src/types.js';

/** The mobile sheet is intentionally square-cornered (full-screen media query). */
function isMobileViewport(page: Page): boolean {
  const viewport = page.viewportSize();
  return viewport !== null && viewport.width < MOBILE_BREAKPOINT_PX;
}

// P2-T04: init theme/copy change the rendered modal; host CSS on tk- classes overrides cleanly;
// default theme matches the Charter values.

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

test('default theme matches Charter §7.3 values', async ({ page }) => {
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  // header renders the Riley's-orange default
  await expect(page.locator('.tk-header')).toHaveCSS('background-color', 'rgb(242, 107, 29)');
  const vars = await page.locator('.tk-overlay').evaluate((el) => ({
    primary: el.style.getPropertyValue('--tk-primary'),
    accent: el.style.getPropertyValue('--tk-accent'),
    radius: el.style.getPropertyValue('--tk-border-radius'),
    z: el.style.getPropertyValue('--tk-z-index'),
  }));
  expect(vars).toEqual({ primary: '#8EA0F6', accent: '#EA8D00', radius: '15px', z: '2147483000' });
  if (!isMobileViewport(page)) {
    await expect(page.locator('.tk-modal')).toHaveCSS('border-radius', '15px');
  }
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
