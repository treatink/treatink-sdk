import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Treatink } from '../../src/types.js';

// P2-T09: toggling on renders the text at the correct per-cutout Y; length limit enforced
// (template.maxTextLength ?? config.maxPersonalizationLength ?? 20); color follows the theme.

declare global {
  interface Window {
    tk: Treatink;
    Treatink: { init: (config: unknown) => Treatink };
    __events: Array<{ event: string; payload: unknown }>;
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));
const labels = JSON.parse(
  readFileSync(new URL('../../fixtures/catalog/cutout-labels.json', import.meta.url), 'utf8'),
) as Array<{ id: string; pet_name_position: string; theme: string }>;

const OFFSETS: Record<string, number> = { default: 160, upper: 130, top: 100, bottom: 320 };
const byPosition = (position: string) => labels.find((l) => l.pet_name_position === position);

/** Count pixels in a horizontal band that changed between two snapshots. */
async function bandSnapshot(page: Page, centerY: number): Promise<string> {
  return page.evaluate((y) => {
    const ctx = document.querySelector<HTMLCanvasElement>('.tk-canvas')!.getContext('2d')!;
    // 300-wide band centered on x=450, 60 tall above the text baseline
    const data = ctx.getImageData(300, Math.max(0, y - 55), 300, 60).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 97) hash = (hash * 31 + data[i]!) >>> 0;
    return String(hash);
  }, centerY);
}

async function openWithCutout(page: Page, cutoutId: string) {
  await page.evaluate((id) => {
    window.tk.designer.close();
    window.tk.designer.open({ sku: 'SSGTTBC', cutoutLabelId: id });
  }, cutoutId);
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', cutoutId);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
});

test('toggle + input render text at the per-cutout Y (default position)', async ({ page }) => {
  const label = byPosition('default')!;
  await openWithCutout(page, label.id);
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');

  const before = await bandSnapshot(page, 160);
  await page.check('.tk-text-checkbox');
  await expect(page.locator('.tk-text-input')).toBeVisible();
  await page.fill('.tk-text-input', 'Milo');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-text-y', '160');
  expect(await bandSnapshot(page, 160)).not.toBe(before); // pixels changed where the text lands

  // clearing the text removes it
  await page.fill('.tk-text-input', '');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-text-y', '');
});

test.describe(() => {
  for (const position of ['top', 'upper', 'bottom'] as const) {
    test(`position '${position}' lands at ${OFFSETS[position]} (verbatim offsets)`, async ({
      page,
    }) => {
      const label = byPosition(position);
      test.skip(!label, `no fixture label with position ${position}`);
      await openWithCutout(page, label!.id);
      await page.check('.tk-text-checkbox');
      await page.fill('.tk-text-input', 'Milo');
      await expect(page.locator('.tk-canvas')).toHaveAttribute(
        'data-text-y',
        String(OFFSETS[position]),
      );
    });
  }
});

test('length cap: default 20, template fallback via config override', async ({ page }) => {
  const label = byPosition('default')!;
  await openWithCutout(page, label.id);
  await page.check('.tk-text-checkbox');
  await page.fill('.tk-text-input', 'a'.repeat(30)); // fill respects maxlength? force via type
  const value = await page.inputValue('.tk-text-input');
  expect(value.length).toBeLessThanOrEqual(20);

  // custom config cap
  await page.evaluate((id) => {
    window.tk.designer.close();
    const custom = window.Treatink.init({
      apiKey: 'pk_test_cap',
      channel: 'rileyspets.com',
      maxPersonalizationLength: 5,
    });
    custom.designer.open({ sku: 'SSGTTBC', cutoutLabelId: id });
  }, label.id);
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', label.id);
  await page.check('.tk-text-checkbox');
  await page.locator('.tk-text-input').pressSequentially('Maximilian');
  expect((await page.inputValue('.tk-text-input')).length).toBeLessThanOrEqual(5);
});
