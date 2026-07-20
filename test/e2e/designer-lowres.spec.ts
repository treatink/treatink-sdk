import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Treatink } from '../../src/types.js';

// P2-T10: a small/over-zoomed photo triggers the non-blocking warning, announced to AT.

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
});

test('a small photo trips the warning immediately; a large one does not', async ({ page }) => {
  await expect(page.locator('.tk-lowres')).toBeHidden(); // nothing loaded yet
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'lowres.png'));
  await expect(page.locator('.tk-lowres')).toBeVisible();
  // announced politely to AT
  await expect(page.locator('.tk-live')).toContainText('low resolution');

  // replacing with a high-res photo clears it
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-lowres')).toBeHidden();
  await expect(page.locator('.tk-live')).toHaveText('');
});

test('over-zooming a borderline photo trips the warning; zooming back clears it', async ({
  page,
}) => {
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'midres.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await expect(page.locator('.tk-lowres')).toBeHidden(); // 900 ≤ 1.05·1000

  await page.locator('.tk-zoom-slider').fill('1.3'); // 1170 > 1050
  await expect(page.locator('.tk-lowres')).toBeVisible();

  await page.locator('.tk-zoom-slider').fill('1');
  await expect(page.locator('.tk-lowres')).toBeHidden();
});

test('the warning does not block interaction (controls stay usable)', async ({ page }) => {
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'lowres.png'));
  await expect(page.locator('.tk-lowres')).toBeVisible();
  // zooming and text entry still work while warned
  await page.locator('.tk-zoom-slider').fill('0.5');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '0.5');
  await page.check('.tk-text-checkbox');
  await expect(page.locator('.tk-text-input')).toBeVisible();
});
