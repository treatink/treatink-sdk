import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Treatink } from '../../src/types.js';

// P2-T03: axe reports 0 serious/critical on the open modal; keyboard trap/restore work.
// (a11y lives inside e2e per docs/06 §7 — `npm run test:a11y` filters this spec.)

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

test('axe: no serious or critical violations on the open modal', async ({ page }) => {
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.tk-overlay').analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(', ')}`),
  ).toEqual([]);
});

test('dialog semantics: role, aria-modal, labeled close control', async ({ page }) => {
  await page.click('#open-designer');
  const modal = page.locator('.tk-modal');
  await expect(modal).toHaveAttribute('aria-modal', 'true');
  await expect(modal).toHaveAttribute('role', 'dialog');
  await expect(page.locator('.tk-close')).toHaveAttribute('aria-label', 'Close');
});

test('initial focus lands inside the dialog; Tab is trapped', async ({ page }) => {
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  // initial focus inside
  expect(
    await page.evaluate(() =>
      document.querySelector('.tk-overlay')?.contains(document.activeElement),
    ),
  ).toBe(true);
  // Tab several times — focus never escapes the overlay
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() =>
        document.querySelector('.tk-overlay')?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  // and Shift+Tab too
  await page.keyboard.press('Shift+Tab');
  expect(
    await page.evaluate(() =>
      document.querySelector('.tk-overlay')?.contains(document.activeElement),
    ),
  ).toBe(true);
});

test('Escape closes and focus returns to the opener', async ({ page }) => {
  await page.focus('#open-designer');
  await page.keyboard.press('Enter'); // open via keyboard
  await expect(page.locator('.tk-modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('open-designer');
  const events = await page.evaluate(() => window.__events.map((e) => e.event));
  expect(events).toContain('designer:close');
});

test('the polite live region exists for AT announcements', async ({ page }) => {
  await page.click('#open-designer');
  await expect(page.locator('.tk-live')).toHaveAttribute('aria-live', 'polite');
});
