import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Treatink } from '../../src/types.js';

const labels = JSON.parse(
  readFileSync(new URL('../../fixtures/catalog/cutout-labels.json', import.meta.url), 'utf8'),
) as Array<{ id: string; category: string }>;

// P2-T08 (+P5-T07): store frame-select card (docs/13 §5.3) — collapsible header, metadata-driven
// chips (no Browse-All chip), 3-up pager with orange dots, layered photo-behind-frame thumbs,
// auto-preselected default cutout; the Browse All BUTTON shows the full set.

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

test('chips come from fixture metadata; Browse All is a button below', async ({ page }) => {
  const chipValues = await page
    .locator('.tk-chip')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset['category']));
  expect(chipValues).toEqual(CATEGORIES); // no __all__ chip (store: chips are categories only)
  await expect(page.locator('.tk-browse-all')).toHaveText('Browse All');
  // first category active by default; its row shows exactly its templates
  await expect(page.locator('.tk-chip').first()).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.tk-cutout-thumb')).toHaveCount(FIRST_CATEGORY_COUNT);
});

test('the default cutout auto-preselects on open and draws on the canvas', async ({ page }) => {
  // store behavior: a default frame is selected before any interaction (docs/13 §5.3)
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', labels[0]!.id);
  const alpha = await page.evaluate(() => {
    const ctx = document.querySelector<HTMLCanvasElement>('.tk-canvas')!.getContext('2d')!;
    return ctx.getImageData(8, 8, 1, 1).data[3]!;
  });
  expect(alpha).toBeGreaterThan(0); // the frame PNG is on the canvas with no photo yet
  await expect(page.locator(`.tk-cutout-thumb[data-cutout="${labels[0]!.id}"]`)).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the header collapses and expands the browser (aria-expanded)', async ({ page }) => {
  const toggle = page.locator('.tk-cutouts-toggle');
  const height = () =>
    page.evaluate(() => document.querySelector<HTMLElement>('.tk-collapsible')!.clientHeight);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(await height()).toBeGreaterThan(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(height).toBe(0); // collapsed to height 0 after the transition
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(height).toBeGreaterThan(0);
});

test('the pager pages by 3 with clickable orange dots', async ({ page }) => {
  const expectedDots = Math.ceil(FIRST_CATEGORY_COUNT / 3);
  await expect(page.locator('.tk-dot')).toHaveCount(expectedDots);
  await expect(page.locator('.tk-dot').first()).toHaveAttribute('aria-current', 'true');
  await page.locator('.tk-dot').last().click();
  await page.waitForFunction(() => {
    const row = document.querySelector<HTMLElement>('.tk-cutout-row')!;
    return row.scrollLeft > 0;
  });
  await expect(page.locator('.tk-dot').last()).toHaveAttribute('aria-current', 'true');
});

test('thumbs live-preview the photo behind each frame after upload', async ({ page }) => {
  await expect(page.locator('.tk-thumb-photo')).toHaveCount(0); // no photo yet
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  const photoLayers = page.locator('.tk-cutout-thumb .tk-thumb-photo');
  await expect(photoLayers.first()).toBeVisible();
  expect(await photoLayers.count()).toBe(FIRST_CATEGORY_COUNT);
  await expect(photoLayers.first()).toHaveAttribute('src', /^blob:/);
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
  await page.click('.tk-browse-all');
  await expect(page.locator('.tk-cutout-thumb')).toHaveCount(labels.length);
});

test('switching cutouts re-renders the composite over the photo', async ({ page }) => {
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  // the default frame is already selected (auto-preselect); switch to a different one
  const secondId = labels[1]!.id;
  await page.click(`.tk-cutout-thumb[data-cutout="${secondId}"]`);
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', secondId);
  await expect(page.locator(`.tk-cutout-thumb[data-cutout="${secondId}"]`)).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.locator(`.tk-cutout-thumb[data-cutout="${labels[0]!.id}"]`)).toHaveAttribute(
    'aria-selected',
    'false',
  );
  // and back again
  await page.click(`.tk-cutout-thumb[data-cutout="${labels[0]!.id}"]`);
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', labels[0]!.id);
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
