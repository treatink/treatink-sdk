import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Treatink } from '../../src/types.js';

// P2-T06: a HEIC upload succeeds and renders; the decoder chunk is absent from initial bundles
// and loads only on first HEIC ingest (verified via network).

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));

test('HEIC uploads transcode and render; the decoder loads lazily, exactly on demand', async ({
  page,
}) => {
  const scriptRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/dist/')) scriptRequests.push(request.url());
  });

  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();

  // a normal PNG upload first — still no decoder on the wire
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-width', '1536');
  const isDecoderUrl = (url: string) => /heic/i.test(url);
  expect(scriptRequests.filter(isDecoderUrl)).toEqual([]);

  // now the HEIC — decoder chunk fetched on demand, photo decodes and renders
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'photo.heic'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-width', '1536', {
    timeout: 30_000, // wasm decode can be slow on first run
  });
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-height', '2048');
  expect(scriptRequests.filter(isDecoderUrl).length).toBeGreaterThan(0);

  // rendered pixels present at the canvas center
  const painted = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.tk-canvas')!;
    return canvas.getContext('2d')!.getImageData(450, 600, 1, 1).data[3]! > 0;
  });
  expect(painted).toBe(true);
});

test('the initial page load never fetches the decoder chunk', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
  await page.click('#open-designer');
  await expect(page.locator('.tk-modal')).toBeVisible();
  expect(requests.filter((u) => /heic/i.test(u))).toEqual([]);
});
