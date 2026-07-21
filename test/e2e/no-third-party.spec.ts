import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { DesignerResult, Treatink } from '../../src/types.js';

/**
 * P4-T06 — the SDK makes NO third-party requests (Charter §9, §10.3; docs/11 §2). Every asset the
 * designer needs is bundled: the lazy designer chunk, the Mitr personalization font, and the HEIC
 * transcoder. This spec drives the heaviest paths (HEIC upload → text → save) and asserts every
 * network destination is the harness origin (stand-in for the API/CDN/storage hosts) — no analytics,
 * no external fonts, no trackers, no CDN fetch. `blob:`/`data:` are in-page, not network egress.
 */

declare global {
  interface Window {
    tk: Treatink;
    __completions: DesignerResult[];
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));
const HARNESS_ORIGIN = 'http://localhost:5199';

test('the whole design→save flow hits no third-party origin', async ({ page }) => {
  test.setTimeout(60_000);

  const requests: string[] = [];
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/^(blob|data):/.test(url)) return; // in-page pseudo-requests, not egress
    requests.push(url);
    if (!url.startsWith(HARNESS_ORIGIN)) foreign.push(url);
  });

  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));

  // Open + upload a HEIC (exercises the BUNDLED transcoder, not a CDN fetch).
  await page.evaluate(() => {
    window.__completions = [];
    window.tk.designer.open({
      sku: 'SSGTTBC',
      cutoutLabelId: 'cut_fx_00000001',
      onComplete: (result) => window.__completions.push(result),
    });
  });
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', 'cut_fx_00000001');
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'photo.heic'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-width', '1536', {
    timeout: 30_000,
  });

  // Personalization text pulls the BUNDLED Mitr font — must not fetch an external font.
  await page.check('.tk-text-checkbox');
  await page.fill('.tk-text-input', 'Milo');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-text-y', '160');

  // Save runs the two-asset upload (fixtures: in-memory, no egress).
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0, { timeout: 30_000 });
  const result = await page.evaluate(() => window.__completions[0]!);
  expect(result.artwork.sourceAssetId).toMatch(/^ast_fx_/);

  // The core assertion: not a single request left the harness origin.
  expect(foreign).toEqual([]);
  // Sanity: the listener actually observed traffic (the module graph loaded on-origin).
  expect(requests.some((u) => u.includes('/dist/'))).toBe(true);
});
