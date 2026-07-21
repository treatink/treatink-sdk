import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { DesignerResult, Treatink } from '../../src/types.js';

// P3-T04: designer.open({ draftId }) restores cutout + transform + text + zone; the photo is NOT
// auto-restored (documented limitation) — re-selecting applies the draft transform; a re-save
// creates a fresh draft + assets.

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
    __completions: DesignerResult[];
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));

/** Save a design with a custom transform + text; returns the completion. */
async function saveDesign(page: Page): Promise<DesignerResult> {
  await page.evaluate(() => {
    window.__completions = window.__completions ?? [];
    window.tk.designer.open({
      sku: 'SSGTTBC',
      cutoutLabelId: 'cut_fx_00000005',
      onComplete: (result) => window.__completions.push(result),
    });
  });
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', 'cut_fx_00000005');
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await page.locator('.tk-zoom-slider').fill('1.2'); // distinctive transform
  await page.check('.tk-text-checkbox');
  await page.fill('.tk-text-input', 'Milo');
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);
  return page.evaluate(() => window.__completions.at(-1)!);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
  await page.evaluate(() => localStorage.clear());
});

test('re-open restores cutout, text, and (via photo re-select) the transform', async ({ page }) => {
  const saved = await saveDesign(page);

  await page.evaluate(
    (draftId) =>
      window.tk.designer.open({
        sku: 'SSGTTBC',
        draftId,
        onComplete: (r) => window.__completions.push(r),
      }),
    saved.draftId,
  );
  await expect(page.locator('.tk-modal')).toBeVisible();
  // cutout + text metadata restored immediately
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', 'cut_fx_00000005');
  await expect(page.locator('.tk-text-checkbox')).toBeChecked();
  await expect(page.locator('.tk-text-input')).toHaveValue('Milo');
  // the photo is NOT auto-restored — the on-canvas upload overlay prompts for re-selection
  await expect(page.locator('.tk-canvas')).not.toHaveAttribute('data-natural-width', /.+/);
  await expect(page.locator('.tk-upload-overlay')).toBeVisible();
  await expect(page.locator('.tk-save-button')).toBeDisabled(); // no photo yet

  // re-selecting the photo applies the DRAFT transform, not the initial fit
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute(
    'data-scale',
    String(saved.transform.scale),
  );
  const x = parseFloat((await page.locator('.tk-canvas').getAttribute('data-x'))!);
  const y = parseFloat((await page.locator('.tk-canvas').getAttribute('data-y'))!);
  expect(x).toBeCloseTo(saved.transform.x, 1);
  expect(y).toBeCloseTo(saved.transform.y, 1);
});

test('re-save creates a fresh draft + fresh assets', async ({ page }) => {
  const saved = await saveDesign(page);
  await page.evaluate(
    (draftId) =>
      window.tk.designer.open({
        sku: 'SSGTTBC',
        draftId,
        onComplete: (r) => window.__completions.push(r),
      }),
    saved.draftId,
  );
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1.2');
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);

  const [first, second] = await page.evaluate(() => window.__completions);
  expect(second!.draftId).not.toBe(first!.draftId);
  expect(second!.artwork.sourceAssetId).not.toBe(first!.artwork.sourceAssetId);
  expect(second!.artwork.renderedAssetId).not.toBe(first!.artwork.renderedAssetId);
  // both drafts exist (re-save is additive; in-place re-edit is deferred, Charter §2)
  const draftIds = await page.evaluate(() => window.tk.drafts.list().map((d) => d.draftId));
  expect(draftIds).toContain(first!.draftId);
  expect(draftIds).toContain(second!.draftId);
});

test('a replacement photo AFTER restore re-fits fresh (restore is one-shot)', async ({ page }) => {
  const saved = await saveDesign(page);
  await page.evaluate(
    (draftId) =>
      window.tk.designer.open({
        sku: 'SSGTTBC',
        draftId,
        onComplete: (r) => window.__completions.push(r),
      }),
    saved.draftId,
  );
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1.2'); // restored
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1'); // fresh fit
});

test('unknown draftId surfaces not_found and opens fresh', async ({ page }) => {
  await page.evaluate(() => {
    window.tk.designer.open({ sku: 'SSGTTBC', draftId: 'no-such-draft' });
  });
  await expect(page.locator('.tk-modal')).toBeVisible();
  await page.waitForFunction(() =>
    window.__events.some(
      (e) => e.event === 'error' && (e.payload as { code?: string }).code === 'not_found',
    ),
  );
  await expect(page.locator('.tk-text-checkbox')).not.toBeChecked(); // nothing restored
});
