import { expect, test } from '@playwright/test';
import { MOBILE_BREAKPOINT_PX } from '../../src/designer/styles.js';
import type { Treatink } from '../../src/types.js';

// P2-T01: open renders into body; close restores scroll; second open() rejected; layout switches
// at the mobile breakpoint. Events designer:open/close asserted here (P1-T12 note).

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
});

test('open renders the modal portal into document.body with the branded header', async ({
  page,
}) => {
  await page.click('#open-designer');
  const modal = page.locator('.tk-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute('role', 'dialog');
  await expect(page.locator('.tk-title')).toHaveText('Personalize Your Product');
  // portal-rendered at body level
  expect(await page.locator('body > .tk-overlay').count()).toBe(1);
  // scroll-locked page behind
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  // event emitted with the sku payload
  const events = await page.evaluate(() => window.__events);
  expect(events).toContainEqual({ event: 'designer:open', payload: { sku: 'SSGTTBC' } });
});

test('a second open() while live is rejected with bad_request', async ({ page }) => {
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  await page.evaluate(() => window.tk.designer.open({ sku: 'SSGTTBC' }));
  await page.waitForFunction(() => window.__events.some((e) => e.event === 'error'));
  expect(await page.locator('.tk-overlay').count()).toBe(1);
  // extract the code in-page — Error custom props don't survive the serialization bridge
  const codes = await page.evaluate(() =>
    window.__events
      .filter((e) => e.event === 'error')
      .map((e) => (e.payload as { code?: string }).code),
  );
  expect(codes).toContain('bad_request');
});

test('close control unmounts, restores scroll, and fires designer:close', async ({ page }) => {
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  await page.click('.tk-close');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  const events = await page.evaluate(() => window.__events);
  expect(events).toContainEqual({ event: 'designer:close', payload: { sku: 'SSGTTBC' } });
  // reopening works after close
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
});

test('tk.designer.close() is a programmatic close', async ({ page }) => {
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  await page.evaluate(() => window.tk.designer.close());
  await expect(page.locator('.tk-overlay')).toHaveCount(0);
});

test('layout: two columns on desktop, stacked sheet under the mobile breakpoint', async ({
  page,
}) => {
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  const viewport = page.viewportSize();
  const direction = await page
    .locator('.tk-body')
    .evaluate((el) => getComputedStyle(el).flexDirection);
  if (viewport && viewport.width < MOBILE_BREAKPOINT_PX) {
    expect(direction).toBe('column');
  } else {
    expect(direction).toBe('row');
  }
});
