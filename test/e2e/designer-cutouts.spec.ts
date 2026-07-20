import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Treatink } from '../../src/types.js';

const labels = JSON.parse(
  readFileSync(new URL('../../fixtures/catalog/cutout-labels.json', import.meta.url), 'utf8'),
) as Array<{ id: string; category: string }>;

// P2-T08: chips reflect fixture template categories (metadata-driven, not hard-coded); selection
// updates the preview with the frame PNG on top; Browse All lists all templates for the SKU.

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));
const CATEGORIES = [...new Set(labels.map((l) => l.category))];
const FIRST_CATEGORY_COUNT = labels.filter((l) => l.category === CATEGORIES[0]).length;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  await expect(page.locator('.tk-chip').first()).toBeVisible();
});

test('chips come from fixture metadata plus Browse All', async ({ page }) => {
  const chipValues = await page
    .locator('.tk-chip')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset['category']));
  expect(chipValues).toEqual([...CATEGORIES, '__all__']);
  await expect(page.locator('.tk-chip').last()).toHaveText('Browse All');
  // first category active by default; its row shows exactly its templates
  await expect(page.locator('.tk-chip').first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.tk-cutout-thumb')).toHaveCount(FIRST_CATEGORY_COUNT);
});

test('switching category re-filters the thumbnail row', async ({ page }) => {
  const second = CATEGORIES[1]!;
  const expected = labels.filter((l) => l.category === second).length;
  await page.click(`.tk-chip[data-category="${second}"]`);
  await expect(page.locator(`.tk-chip[data-category="${second}"]`)).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator('.tk-cutout-thumb')).toHaveCount(expected);
});

test('Browse All lists every template for the SKU', async ({ page }) => {
  await page.click('.tk-chip[data-category="__all__"]');
  await expect(page.locator('.tk-cutout-thumb')).toHaveCount(labels.length);
});

test('selecting a cutout draws the frame PNG on top of the photo', async ({ page }) => {
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  const cornerBefore = await page.evaluate(() => {
    const ctx = document.querySelector<HTMLCanvasElement>('.tk-canvas')!.getContext('2d')!;
    return [...ctx.getImageData(8, 8, 1, 1).data];
  });
  const firstId = labels[0]!.id;
  await page.click(`.tk-cutout-thumb[data-cutout="${firstId}"]`);
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', firstId);
  const cornerAfter = await page.evaluate(() => {
    const ctx = document.querySelector<HTMLCanvasElement>('.tk-canvas')!.getContext('2d')!;
    return [...ctx.getImageData(8, 8, 1, 1).data];
  });
  expect(cornerAfter).not.toEqual(cornerBefore); // the frame corner covers the photo corner
  // switching to another cutout re-renders again
  const secondId = labels[1]!.id;
  await page.click(`.tk-cutout-thumb[data-cutout="${secondId}"]`);
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', secondId);
});

test('open({ cutoutLabelId }) preselects the cutout', async ({ page }) => {
  const target = labels[2]!.id;
  await page.evaluate((id) => {
    window.tk.designer.close();
    window.tk.designer.open({ sku: 'SSGTTBC', cutoutLabelId: id });
  }, target);
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', target);
});

test('unknown preselect id surfaces not_found', async ({ page }) => {
  await page.evaluate(() => {
    window.tk.designer.close();
    window.tk.designer.open({ sku: 'SSGTTBC', cutoutLabelId: 'cut_fx_nope' });
  });
  await page.waitForFunction(() =>
    window.__events.some(
      (e) => e.event === 'error' && (e.payload as { code?: string }).code === 'not_found',
    ),
  );
});
