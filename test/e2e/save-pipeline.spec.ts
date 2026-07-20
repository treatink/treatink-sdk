import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { DesignerResult, Treatink } from '../../src/types.js';

// P3-T01: Save runs the two-asset upload (source + rendered, declare→PUT→finalize each) against
// fixtures and returns a complete DesignerResult. Asset-based — no sessionId anywhere (GP-07).

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
    __completions: DesignerResult[];
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));

async function openForSave(page: Page) {
  await page.evaluate(() => {
    window.__completions = window.__completions ?? [];
    window.tk.designer.open({
      sku: 'SSGTTBC',
      cutoutLabelId: 'cut_fx_00000001',
      onComplete: (result) => window.__completions.push(result),
    });
  });
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', 'cut_fx_00000001');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
});

test('save uploads source + rendered and returns their real asset ids', async ({ page }) => {
  const foreignRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    // blob:/data: are in-page pseudo-requests, not network egress
    if (/^(blob|data):/.test(url)) return;
    if (!url.startsWith('http://localhost:5199')) foreignRequests.push(url);
  });
  await openForSave(page);
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await page.check('.tk-text-checkbox');
  await page.fill('.tk-text-input', 'Milo');
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);

  const result = await page.evaluate(() => window.__completions[0]!);
  expect(result.artwork.sourceAssetId).toMatch(/^ast_fx_/);
  expect(result.artwork.renderedAssetId).toMatch(/^ast_fx_/);
  expect(result.artwork.sourceAssetId).not.toBe(result.artwork.renderedAssetId);
  expect(result.previewUrl).toMatch(/^blob:/);
  expect(result.transform).toMatchObject({ rotation: 0, scale: 1 });
  expect(result.lowRes).toBe(false);
  // asset-based end to end: no session concept leaks anywhere (GP-07/GP-18)
  expect(JSON.stringify(result).toLowerCase()).not.toContain('session');
  // uploads never left localhost — fixture "PUT" is in-memory (docs/08 §6b)
  expect(foreignRequests).toEqual([]);
});

test('a HEIC photo saves too — the transcoded JPEG becomes the source asset', async ({ page }) => {
  await openForSave(page);
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'photo.heic'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-width', '1536', {
    timeout: 30_000,
  });
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0, { timeout: 30_000 });
  const result = await page.evaluate(() => window.__completions[0]!);
  expect(result.artwork.sourceAssetId).toMatch(/^ast_fx_/);
  expect(result.artwork.renderedAssetId).toMatch(/^ast_fx_/);
});

test('each save produces fresh asset ids (no reuse across saves)', async ({ page }) => {
  await openForSave(page);
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);

  await openForSave(page);
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);

  const [first, second] = await page.evaluate(() => window.__completions);
  expect(first!.draftId).not.toBe(second!.draftId);
  expect(first!.artwork.sourceAssetId).not.toBe(second!.artwork.sourceAssetId);
  expect(first!.artwork.renderedAssetId).not.toBe(second!.artwork.renderedAssetId);
});
