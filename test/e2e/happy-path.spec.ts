import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { submitOrder } from '../../server/index.js';
import type { DesignerResult, OrderPayload, Treatink } from '../../src/types.js';

/**
 * P3-T07 — the Charter §14 Definition-of-Done demo, fixtures mode, one flow:
 * catalog → designer.open → upload (HEIC) → position/zoom → text → save (failure→retry, then
 * success) → buildPayload → server submitOrder (mock endpoint, idempotent) → draft re-open.
 */

declare global {
  interface Window {
    tk: Treatink;
    __events: Array<{ event: string; payload: unknown }>;
    __completions: DesignerResult[];
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));

test('the full happy path (Charter §14)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.tk));
  await page.evaluate(() => localStorage.clear());

  // 1 · catalog
  const product = await page.evaluate(async () => {
    const listed = await window.tk.products.list({ limit: 100 });
    if (listed.data.length !== 14)
      throw new Error(`expected 14 products, got ${listed.data.length}`);
    return window.tk.products.get('SSGTTBC');
  });
  expect(product.variantId).toMatch(/^var_fx_/);

  // 2 · open the designer
  await page.evaluate(() => {
    window.__completions = [];
    window.tk.designer.open({
      sku: 'SSGTTBC',
      cutoutLabelId: 'cut_fx_00000001',
      onComplete: (result) => window.__completions.push(result),
    });
  });
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', 'cut_fx_00000001');

  // 3 · upload — a HEIC, transcoded by the lazy decoder chunk
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'photo.heic'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-natural-width', '1536', {
    timeout: 30_000,
  });

  // 4 · position: drag + zoom
  const box = (await page.locator('.tk-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 3 });
  await page.mouse.up();
  await page.locator('.tk-zoom-slider').fill('1.2');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1.2');

  // 5 · personalization text
  await page.check('.tk-text-checkbox');
  await page.fill('.tk-text-input', 'Milo');
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-text-y', '160');

  // 6 · save: simulated FAILURE first, then retry succeeds
  await page.evaluate(() =>
    window.tk.fixtures!.failNext('assets.finalize', {
      status: 422,
      code: 'upload_validation_failed',
    }),
  );
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-save-error')).toBeVisible();
  await page.click('.tk-save-button'); // retry
  await expect(page.locator('.tk-overlay')).toHaveCount(0, { timeout: 30_000 });
  const result = await page.evaluate(() => window.__completions[0]!);
  expect(result.artwork.sourceAssetId).toMatch(/^ast_fx_/);

  // 7 · buildPayload from the persisted draft (browser, pure)
  const payload = await page.evaluate((draftId) => {
    return window.tk.orders.buildPayload({
      externalOrderId: 'partner-1001',
      channelOrderNumber: '1001',
      currency: 'USD',
      paymentStatus: 'paid',
      customer: { email: 'a@b.com', firstName: 'A', lastName: 'B' },
      lines: [{ externalLineItemId: 'li-1', draftId, quantity: 1, unitPriceCents: 999 }],
    });
  }, result.draftId);
  const line = (payload as { line_items: Record<string, unknown>[] }).line_items[0]!;
  expect(line['variant_id']).toBe(result.variantId);
  expect(line['source_asset_id']).toBe(result.artwork.sourceAssetId);
  expect(line['rendered_asset_id']).toBe(result.artwork.renderedAssetId);
  expect((line['personalization'] as { personalization_text: string }).personalization_text).toBe(
    'Milo',
  );

  // 8 · server submitOrder — partner-server side (Node), mocked endpoint, idempotent
  const originalFetch = globalThis.fetch;
  const seen: Record<string, unknown> = {};
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { external_order_id: string };
    seen['url'] = String(url);
    seen['idempotencyKey'] = (init?.headers as Record<string, string>)['Idempotency-Key'];
    return new Response(
      JSON.stringify({
        id: 'ord_fx_00000001',
        order_number: '1001',
        status: 'received',
        external_order_id: body.external_order_id,
      }),
      { status: 201 },
    );
  }) as typeof fetch;
  try {
    const order = await submitOrder(payload as OrderPayload, {
      secretKey: 'sk_test_server',
      channel: 'rileyspets.com',
    });
    expect(order.status).toBe('received');
    expect(order.externalOrderId).toBe('partner-1001');
    expect(seen['idempotencyKey']).toBe('partner-1001');
    const again = await submitOrder(payload as OrderPayload, {
      secretKey: 'sk_test_server',
      channel: 'rileyspets.com',
    });
    expect(again).toEqual(order); // idempotent re-post
  } finally {
    globalThis.fetch = originalFetch;
  }

  // 9 · draft re-open restores the layout
  await page.evaluate(
    (draftId) => window.tk.designer.open({ sku: 'SSGTTBC', draftId }),
    result.draftId,
  );
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', 'cut_fx_00000001');
  await expect(page.locator('.tk-text-input')).toHaveValue('Milo');
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1.2'); // restored
});
