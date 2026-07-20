import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { DesignerResult, Treatink } from '../../src/types.js';

// P2-T11: Save renders the composite and calls onComplete with a well-formed local DesignerResult
// (object-URL preview; artwork ids empty until P3); the modal closes on success.

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
    __completions: DesignerResult[];
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));
const labels = JSON.parse(
  readFileSync(new URL('../../fixtures/catalog/cutout-labels.json', import.meta.url), 'utf8'),
) as Array<{ id: string; pet_name_position: string }>;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
});

async function openForSave(page: Page, cutoutId: string) {
  await page.evaluate((id) => {
    window.__completions = [];
    window.tk.designer.open({
      sku: 'SSGTTBC',
      cutoutLabelId: id,
      onComplete: (result) => window.__completions.push(result),
    });
  }, cutoutId);
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', cutoutId);
}

test('save produces a well-formed DesignerResult and closes the modal', async ({ page }) => {
  const label = labels[0]!;
  await openForSave(page, label.id);
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await page.check('.tk-text-checkbox');
  await page.fill('.tk-text-input', 'Milo');
  await page.click('.tk-save-button');

  await expect(page.locator('.tk-overlay')).toHaveCount(0); // closed on success
  const result = await page.evaluate(() => window.__completions[0]!);
  expect(result.draftId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(result.sku).toBe('SSGTTBC');
  expect(result.variantId).toMatch(/^var_fx_/);
  expect(result.cutoutLabelId).toBe(label.id);
  expect(result.personalizationText).toBe('Milo');
  expect(result.petNamePosition).toBe(label.pet_name_position);
  expect(result.previewUrl).toMatch(/^blob:/); // LOCAL object URL (GP-08)
  expect(result.artwork.sourceAssetId).toMatch(/^ast_fx_/); // real ids since P3-T01
  expect(result.artwork.renderedAssetId).toMatch(/^ast_fx_/);
  expect(result.transform.rotation).toBe(0);
  expect(result.transform.scale).toBe(1);
  expect(result.transform.x).toBe(0);
  expect(result.transform.y).toBe(132);
  expect(result.labelZone.width).toBeGreaterThan(0);
  expect(result.lowRes).toBe(false);
});

test('the preview object URL is a real image (the display composite)', async ({ page }) => {
  await openForSave(page, labels[0]!.id);
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);
  const dims = await page.evaluate(async () => {
    const img = new Image();
    img.src = window.__completions[0]!.previewUrl;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  });
  // SSGTTBC has a mockup + label_zone → the preview is the 1000×1000 product mockup composite
  expect(dims).toEqual({ width: 1000, height: 1000 });
});

test('save stays disabled until both photo and cutout exist', async ({ page }) => {
  await page.click('#open-designer'); // no preselect
  await expect(page.locator('.tk-modal')).toBeVisible();
  await expect(page.locator('.tk-save-button')).toBeDisabled();
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await expect(page.locator('.tk-save-button')).toBeDisabled(); // still no cutout
  const firstThumb = page.locator('.tk-cutout-thumb').first();
  await firstThumb.click();
  await expect(page.locator('.tk-save-button')).toBeEnabled();
});

test('low-res warns but does not block saving (Charter D.8)', async ({ page }) => {
  await openForSave(page, labels[0]!.id);
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'lowres.png'));
  await expect(page.locator('.tk-lowres')).toBeVisible();
  await expect(page.locator('.tk-save-button')).toBeEnabled();
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);
  const result = await page.evaluate(() => window.__completions[0]!);
  expect(result.lowRes).toBe(true);
});
