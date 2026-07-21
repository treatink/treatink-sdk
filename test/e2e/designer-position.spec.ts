import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { Treatink } from '../../src/types.js';

// P2-T07 (+P5-T04): drag moves the photo; the SLIDER-ONLY zoom (store desktop, VP-03) changes
// scale within [0.5, maxScale]; the px-dimensions tooltip tracks the value (docs/13 §5.1);
// preview matches the engine composite (re-render observed at the pixel level).

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
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
});

const num = async (page: Page, attr: string) =>
  parseFloat((await page.locator('.tk-canvas').getAttribute(attr))!);

test('initial fit lands at the store anchors (x=0, y=132, scale 1)', async ({ page }) => {
  expect(await num(page, 'data-x')).toBe(0);
  expect(await num(page, 'data-y')).toBe(132);
  const slider = page.locator('.tk-zoom-slider');
  await expect(slider).toHaveValue('1');
  await expect(slider).toHaveAttribute('min', '0.5');
  await expect(slider).toHaveAttribute('max', '1.3'); // portrait maxScale
});

test('zoom is slider-only (store desktop) and clamps to [0.5, maxScale]', async ({ page }) => {
  // VP-03: the −/+ buttons are gone — the range input is the only zoom control.
  await expect(page.locator('.tk-zoom-in')).toHaveCount(0);
  await expect(page.locator('.tk-zoom-out')).toHaveCount(0);
  const slider = page.locator('.tk-zoom-slider');
  await slider.fill('1.3'); // ceiling = maxScale
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1.3');
  await slider.fill('0.5'); // floor
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '0.5');
  // keyboard still zooms (native range arrows — a11y stays without buttons)
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '0.6');
});

test('the tooltip shows the scaled px dimensions and tracks the value', async ({ page }) => {
  // portrait 1536×2048 fit → base box 900×1200 (docs/05 §3); tooltip = box × scale.
  const tooltip = page.locator('.tk-slider-tooltip');
  await expect(tooltip).toHaveText('900 x 1200px');
  await page.locator('.tk-zoom-slider').fill('0.5');
  await expect(tooltip).toHaveText('450 x 600px');
  await page.locator('.tk-zoom-slider').fill('1.2');
  await expect(tooltip).toHaveText('1080 x 1440px');
});

test('the slider drives scale directly', async ({ page }) => {
  await page.locator('.tk-zoom-slider').fill('1.2');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1.2');
});

test('zooming out re-renders the composite (corner empties as the photo shrinks)', async ({
  page,
}) => {
  const cornerAlpha = () =>
    page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.tk-canvas')!;
      return canvas.getContext('2d')!.getImageData(50, 200, 1, 1).data[3]!;
    });
  expect(await cornerAlpha()).toBeGreaterThan(0); // covered at scale 1
  await page.locator('.tk-zoom-slider').fill('0.5');
  expect(await cornerAlpha()).toBe(0); // photo shrank about its center — corner now empty
});

test('drag pans the photo freeform (no clamping)', async ({ page }) => {
  const canvas = page.locator('.tk-canvas');
  const box = (await canvas.boundingBox())!;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY + 25, { steps: 4 });
  await page.mouse.up();
  // displayed px → canvas px: the canvas is CSS-scaled from 900 wide
  const factor = 900 / box.width;
  expect(await num(page, 'data-x')).toBeCloseTo(40 * factor, 0);
  expect(await num(page, 'data-y')).toBeCloseTo(132 + 25 * factor, 0);

  // far off-canvas drag is allowed (docs/05 §4 — freeform)
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - box.width, startY, { steps: 4 });
  await page.mouse.up();
  expect(await num(page, 'data-x')).toBeLessThan(-700);
});

test('pointer down outside the photo box does not start a drag', async ({ page }) => {
  await page.locator('.tk-zoom-slider').fill('0.5'); // shrink so corners are empty
  const box = (await page.locator('.tk-canvas').boundingBox())!;
  await page.mouse.move(box.x + 5, box.y + 5); // top-left corner — outside the scaled box
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 60, { steps: 2 });
  await page.mouse.up();
  expect(await num(page, 'data-x')).toBe(0); // unchanged
});
