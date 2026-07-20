import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { DesignerResult, DraftRecord, Treatink } from '../../src/types.js';

// P3-T03 e2e: a successful save writes one small JSON DraftRecord (references only) and emits
// draft:saved; list/get/delete/clear work over the real localStorage.

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
    __completions: DesignerResult[];
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));

async function saveOnce(page: Page) {
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
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
  await page.evaluate(() => localStorage.clear());
});

test('a successful save writes the reference DraftRecord and fires draft:saved', async ({
  page,
}) => {
  await saveOnce(page);
  const drafts = await page.evaluate(() => window.tk.drafts.list());
  expect(drafts).toHaveLength(1);
  const draft: DraftRecord = drafts[0]!;
  const result = await page.evaluate(() => window.__completions[0]!);
  expect(draft.draftId).toBe(result.draftId);
  expect(draft.artwork).toEqual(result.artwork);
  expect(draft.product).toMatchObject({ sku: 'SSGTTBC' });
  expect(draft.cutout.cutoutLabelId).toBe('cut_fx_00000001');
  expect(draft.status).toBe('completed');

  const events = await page.evaluate(() =>
    window.__events.filter((e) => e.event === 'draft:saved'),
  );
  expect(events).toHaveLength(1);
  expect(events[0]!.payload).toMatchObject({ draftId: result.draftId, sku: 'SSGTTBC' });
});

test('persistence gate: stored values are small JSON — never image bytes', async ({ page }) => {
  await saveOnce(page);
  const stored = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith('treatink:'))
      .map((k) => localStorage.getItem(k)!),
  );
  expect(stored.length).toBeGreaterThan(0);
  for (const value of stored) {
    expect(value.length).toBeLessThan(4096);
    expect(value).not.toContain('data:image');
    expect(value).not.toContain('blob:');
    expect(() => JSON.parse(value) as unknown).not.toThrow();
  }
});

test('get/delete/clear on the public namespace', async ({ page }) => {
  await saveOnce(page);
  const draftId = await page.evaluate(() => window.tk.drafts.list()[0]!.draftId);
  expect(await page.evaluate((id) => window.tk.drafts.get(id)?.draftId, draftId)).toBe(draftId);
  await page.evaluate((id) => window.tk.drafts.delete(id), draftId);
  expect(await page.evaluate((id) => window.tk.drafts.get(id), draftId)).toBeNull();

  await saveOnce(page);
  await page.evaluate(() => window.tk.drafts.clear());
  expect(await page.evaluate(() => window.tk.drafts.list())).toEqual([]);
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('treatink:'))),
  ).toEqual([]);
});
