import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Treatink } from '../../src/types.js';

// P2-T10 (+owner 2026-07-21): low-res DETECTION stays live (data-lowres + DesignerResult.lowRes)
// but the visible banner and the AT announcement are suppressed for now — the specs assert the
// flag flips correctly AND that nothing is shown.

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

test('a small photo trips the flag immediately; a large one does not', async ({ page }) => {
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'lowres.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-lowres', 'true');
  // the banner and the AT announcement stay suppressed (owner 2026-07-21)
  await expect(page.locator('.tk-lowres')).toBeHidden();
  await expect(page.locator('.tk-live')).toHaveText('');

  // replacing with a high-res photo clears the flag
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-lowres', 'false');
});

test('over-zooming a borderline photo trips the flag; zooming back clears it', async ({ page }) => {
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'midres.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-lowres', 'false'); // 900 ≤ 1.05·1000

  await page.locator('.tk-zoom-slider').fill('1.3'); // 1170 > 1050
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-lowres', 'true');
  await expect(page.locator('.tk-lowres')).toBeHidden(); // still no banner

  await page.locator('.tk-zoom-slider').fill('1');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-lowres', 'false');
});

test('the flag does not block interaction (controls stay usable)', async ({ page }) => {
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'lowres.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-lowres', 'true');
  // zooming and text entry still work while flagged
  await page.locator('.tk-zoom-slider').fill('0.5');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '0.5');
  await page.check('.tk-text-checkbox');
  await expect(page.locator('.tk-text-input')).toBeVisible();
});
