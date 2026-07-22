import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Treatink } from '../../src/types.js';

// P2-T05 (+P5-T03): both input paths load a photo; the empty-state overlay sits ON the canvas
// frame and yields once a photo is accepted (docs/13 §4); rotated-EXIF photo displays upright;
// invalid file → unsupported_file_type surfaced in the UI; oversize rejected before any "upload".

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

async function canvasHasPixels(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.tk-canvas');
    if (!canvas) return false;
    const data = canvas.getContext('2d')!.getImageData(450, 600, 1, 1).data;
    return data[3]! > 0; // center pixel painted
  });
}

test('picker path: selecting a photo renders it in the preview at the initial fit', async ({
  page,
}) => {
  // The empty state overlays the canvas frame (store upload-container, docs/13 §4).
  await expect(page.locator('.tk-canvas-frame .tk-upload-overlay')).toBeVisible();
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-width', '1536');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-height', '2048');
  expect(await canvasHasPixels(page)).toBe(true);
  // …and yields once the photo is accepted.
  await expect(page.locator('.tk-upload-overlay')).toBeHidden();
});

test('drag-and-drop path loads the photo too', async ({ page }) => {
  // build a DataTransfer in-page from the served asset and drop it on the canvas frame
  const dataTransfer = await page.evaluateHandle(async () => {
    const blob = await (await fetch('/assets/portrait.png')).blob();
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'portrait.png', { type: 'image/png' }));
    return dt;
  });
  await page.dispatchEvent('.tk-canvas-frame', 'drop', { dataTransfer });
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-width', '1536');
  expect(await canvasHasPixels(page)).toBe(true);
});

test('EXIF orientation 6 photo displays upright (600×800 portrait, not 800×600)', async ({
  page,
}) => {
  // Re-open with the full-width-opening frame (cut_fx_00000030: safe transparent rect x∈[62,900),
  // y∈[362,1200)) so the edge probes below see the PHOTO, not the auto-preselected default frame.
  await page.evaluate(() => {
    window.tk.designer.close();
    window.tk.designer.open({ sku: 'SSGTTBC', cutoutLabelId: 'cut_fx_00000030' });
  });
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', 'cut_fx_00000030');
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'exif-rotated.jpg'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-width', '600');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-height', '800');
  // Orientation 6 = encoded 0th row becomes the visual RIGHT side (90° CW). The encoded-top red
  // band must land on the displayed right edge; the left edge stays blue.
  const edges = await page.evaluate(() => {
    const ctx = document.querySelector<HTMLCanvasElement>('.tk-canvas')!.getContext('2d')!;
    const right = ctx.getImageData(880, 600, 1, 1).data;
    const left = ctx.getImageData(70, 600, 1, 1).data; // inside the frame's transparent opening
    return { right: { r: right[0], g: right[1] }, left: { r: left[0], b: left[2] } };
  });
  expect(edges.right.r!).toBeGreaterThan(180); // red band rotated onto the right edge
  expect(edges.right.g!).toBeLessThan(90);
  expect(edges.left.b!).toBeGreaterThan(120); // left edge is the blue body
});

test('invalid file type shows the inline error and fires unsupported_file_type', async ({
  page,
}) => {
  await page.setInputFiles('.tk-file-input', {
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.locator('.tk-upload-error')).toBeVisible();
  const codes = await page.evaluate(() =>
    window.__events
      .filter((e) => e.event === 'error')
      .map((e) => (e.payload as { code?: string }).code),
  );
  expect(codes).toContain('unsupported_file_type');
  // SVG is rejected too (store guard, useFileHandlers.js:19)
  await page.setInputFiles('.tk-file-input', {
    name: 'vector.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  await expect(page.locator('.tk-upload-error')).toBeVisible();
});

test('oversize file (>25 MB) is rejected with upload_too_large before any processing', async ({
  page,
}) => {
  await page.setInputFiles('.tk-file-input', {
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(25_000_001),
  });
  await expect(page.locator('.tk-upload-error')).toContainText('25 MB');
  const codes = await page.evaluate(() =>
    window.__events
      .filter((e) => e.event === 'error')
      .map((e) => (e.payload as { code?: string }).code),
  );
  expect(codes).toContain('upload_too_large');
  // no photo was accepted
  await expect(page.locator('.tk-canvas')).not.toHaveAttribute('data-natural-width', /.+/);
});

test('clicking anywhere on the empty canvas opens the picker (owner 2026-07-22)', async ({
  page,
}) => {
  const clicked = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const input = document.querySelector<HTMLInputElement>('.tk-file-input')!;
        input.addEventListener(
          'click',
          (e) => {
            e.preventDefault();
            resolve(true);
          },
          { once: true },
        );
        document
          .querySelector('.tk-canvas-frame')!
          .dispatchEvent(new MouseEvent('click', { bubbles: true }));
        setTimeout(() => resolve(false), 500);
      }),
  );
  expect(clicked).toBe(true);
});

test('webp is rejected (backend accepts png/jpeg only)', async ({ page }) => {
  await page.setInputFiles('.tk-file-input', {
    name: 'photo.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from('RIFF....WEBP'),
  });
  await expect(page.locator('.tk-upload-error')).toBeVisible();
  await expect(page.locator('.tk-upload-error')).toContainText('PNG, JPEG, or HEIC');
});

test('a failed upload can be retried with a valid photo', async ({ page }) => {
  await page.setInputFiles('.tk-file-input', {
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('nope'),
  });
  await expect(page.locator('.tk-upload-error')).toBeVisible();
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-upload-error')).toBeHidden();
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-width', '1536');
});
