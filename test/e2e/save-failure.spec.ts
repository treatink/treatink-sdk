import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { DesignerResult, Treatink } from '../../src/types.js';

// P3-T02: each asset sub-step failure (declare / PUT-bytes / finalize) surfaces a clear failure
// state; explicit retry succeeds; nothing persists for an abandoned design; no blind retry.

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
    __completions: DesignerResult[];
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));

async function readyToSave(page: Page) {
  await page.evaluate(() => {
    window.__completions = window.__completions ?? [];
    window.tk.designer.open({
      sku: 'SSGTTBC',
      cutoutLabelId: 'cut_fx_00000001',
      onComplete: (result) => window.__completions.push(result),
    });
  });
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', 'cut_fx_00000001');
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
}

async function errorCodes(page: Page): Promise<(string | undefined)[]> {
  return page.evaluate(() =>
    window.__events
      .filter((e) => e.event === 'error')
      .map((e) => (e.payload as { code?: string }).code),
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
});

const INJECTIONS = [
  { op: 'assets.declare', status: 413, code: 'upload_too_large', label: 'declare' },
  { op: 'assets.put', status: 0, code: 'upload_failed', label: 'browser PUT' },
  { op: 'assets.finalize', status: 422, code: 'upload_validation_failed', label: 'finalize' },
] as const;

for (const injection of INJECTIONS) {
  test(`${injection.label} failure shows the failure state; retry succeeds`, async ({ page }) => {
    await readyToSave(page);
    await page.evaluate(
      ({ op, status, code }) => window.tk.fixtures!.failNext(op, { status, code }),
      injection,
    );
    await page.click('.tk-save-button');

    // failure state: error line visible, modal still open, button back to Save for retry
    await expect(page.locator('.tk-save-error')).toBeVisible();
    await expect(page.locator('.tk-overlay')).toHaveCount(1);
    await expect(page.locator('.tk-save-button')).toBeEnabled();
    expect(await errorCodes(page)).toContain(injection.code);
    expect(await page.evaluate(() => window.__completions.length)).toBe(0);

    // explicit retry (the injected failure was consumed) → success closes the modal
    await page.click('.tk-save-button');
    await expect(page.locator('.tk-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => window.__completions.length)).toBe(1);
  });
}

test('abandoning after a failure persists nothing (docs/02 §6)', async ({ page }) => {
  await readyToSave(page);
  await page.evaluate(() =>
    window.tk.fixtures!.failNext('assets.finalize', {
      status: 422,
      code: 'upload_validation_failed',
    }),
  );
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-save-error')).toBeVisible();
  await page.click('.tk-close'); // abandon instead of retrying
  await expect(page.locator('.tk-overlay')).toHaveCount(0);
  expect(await page.evaluate(() => window.__completions.length)).toBe(0);
  // nothing persisted anywhere
  const stored = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('treatink')),
  );
  expect(stored).toEqual([]);
});

test('no blind retry: one save click performs exactly one declare per asset', async ({ page }) => {
  await readyToSave(page);
  // arm two failures on declare; a single save must consume exactly ONE (the source declare),
  // fail fast, and leave the second armed — proving no hidden auto-retry consumed it.
  await page.evaluate(() => {
    window.tk.fixtures!.failNext('assets.declare', { status: 503, code: 'service_unavailable' });
    window.tk.fixtures!.failNext('assets.declare', { status: 503, code: 'service_unavailable' });
  });
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-save-error')).toBeVisible();
  await page.click('.tk-save-button'); // retry hits the SECOND armed failure
  await expect(page.locator('.tk-save-error')).toBeVisible();
  expect((await errorCodes(page)).filter((c) => c === 'service_unavailable')).toHaveLength(2);
  await page.click('.tk-save-button'); // third attempt: both consumed → success
  await expect(page.locator('.tk-overlay')).toHaveCount(0);
});
