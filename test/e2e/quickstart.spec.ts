import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { submitOrder } from '../../server/index.js';
import type { Treatink } from '../../src/types.js';

/**
 * P3-T08 — the integration quickstart is copy-runnable and stays in lockstep with the docs.
 *
 * `test/e2e/harness/quickstart.html` is the executable twin of the fixtures sample in
 * `docs/12-integration-quickstart.md`. This spec (a) proves the two flows are byte-identical, then
 * (b) runs the harness page through the whole Charter §14 path — the machine proxy for "a cold dev
 * integrates in fixtures in < 1 day from the docs".
 */

declare global {
  interface Window {
    tk: Treatink;
    __cart: Array<{ sku: string; draftId: string; previewUrl: string }>;
  }
}

const ASSETS = fileURLToPath(new URL('./harness/assets', import.meta.url));
const DOC = fileURLToPath(new URL('../../docs/12-integration-quickstart.md', import.meta.url));
const PAGE = fileURLToPath(new URL('./harness/quickstart.html', import.meta.url));

/** Pull the code between the `quickstart:flow` markers and strip its common indentation. */
function extractFlow(text: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.includes('quickstart:flow:start'));
  const end = lines.findIndex((l) => l.includes('quickstart:flow:end'));
  if (start < 0 || end < 0 || end <= start) throw new Error('quickstart:flow markers not found');
  const body = lines.slice(start + 1, end);
  const indents = body
    .filter((l) => l.trim() !== '')
    .map((l) => (l.match(/^\s*/) ?? [''])[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  return body
    .map((l) => (l.trim() === '' ? '' : l.slice(min)))
    .join('\n')
    .trim();
}

test('the documented fixtures flow is byte-identical to the harness page (lockstep)', () => {
  const docFlow = extractFlow(readFileSync(DOC, 'utf8'));
  const pageFlow = extractFlow(readFileSync(PAGE, 'utf8'));
  expect(docFlow).not.toHaveLength(0);
  expect(pageFlow).toBe(docFlow); // the sample you copy is the sample we run
});

test('the quickstart integrates end to end in fixtures mode', async ({ page }) => {
  test.setTimeout(60_000);

  // The SDK never talks to a third party — the whole flow stays on the harness origin (docs/11 §2).
  const foreignRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/^(blob|data):/.test(url)) return;
    if (!url.startsWith('http://localhost:5199')) foreignRequests.push(url);
  });

  // Load the copy-runnable partner page; its inline flow calls Treatink.init + designer.open on load.
  await page.goto('/quickstart.html');
  await page.waitForFunction(() => Boolean(window.tk));
  await page.evaluate(() => localStorage.clear());
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-cutout', 'cut_fx_00000001');

  // Shopper: pick a photo, personalize, save.
  await page.setInputFiles('.tk-file-input', join(ASSETS, 'portrait.png'));
  await expect(page.locator('.tk-canvas')).toHaveAttribute('data-scale', '1');
  await page.check('.tk-text-checkbox');
  await page.fill('.tk-text-input', 'Milo');
  await page.click('.tk-save-button');
  await expect(page.locator('.tk-overlay')).toHaveCount(0, { timeout: 30_000 });

  // onComplete fired → the storefront's add-to-cart recorded the line (draftId + local preview).
  const cartLine = await page.evaluate(() => window.__cart[0]!);
  expect(cartLine.sku).toBe('SSGTTBC');
  expect(cartLine.draftId).toMatch(/[0-9a-f-]{36}/);
  expect(cartLine.previewUrl).toMatch(/^blob:/);
  expect(foreignRequests).toEqual([]);

  // §3 — build the order body from the saved draft (browser, pure).
  const payload = await page.evaluate((draftId) => {
    return window.tk.orders.buildPayload({
      externalOrderId: 'partner-1001',
      displayOrderNumber: '#1001',
      currency: 'USD',
      recipient: { name: 'Sam Rivera', email: 'shopper@example.com' },
      destination: {
        addressLine1: '1 Main St',
        city: 'Austin',
        region: 'TX',
        postalCode: '78701',
        countryCode: 'US',
      },
      amounts: {
        subtotalCents: 999,
        discountCents: 0,
        shippingCents: 295,
        taxCents: 0,
        totalCents: 1294,
      },
      lines: [{ externalLineItemId: 'li-1', draftId, quantity: 1, unitPriceCents: 999 }],
    });
  }, cartLine.draftId);
  const line = (payload as { line_items: Record<string, unknown>[] }).line_items[0]!;
  const personalization = line['personalization'] as Record<string, unknown>;
  expect(personalization['source_asset_id']).toMatch(/^ast_fx_/);
  expect(personalization['rendered_asset_id']).toMatch(/^ast_fx_/);
  expect(personalization['pet_name']).toBe('Milo');

  // §4 — server submit (mock endpoint), and a re-post is idempotent on external_order_id.
  const originalFetch = globalThis.fetch;
  const seen: Record<string, unknown> = {};
  globalThis.fetch = (input: unknown, init?: RequestInit): Promise<Response> => {
    const raw = typeof init?.body === 'string' ? init.body : '{}';
    const body = JSON.parse(raw) as { external_order_id: string };
    seen['idempotencyKey'] = (init?.headers as Record<string, string>)['Idempotency-Key'];
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: 'ord_fx_00000001',
          status: 'received',
          external_order_id: body.external_order_id,
          display_order_number: '#1001',
        }),
        { status: 201 },
      ),
    );
  };
  try {
    const order = await submitOrder(payload, {
      secretKey: 'sk_test_server',
      channel: 'rileyspets.com',
    });
    expect(order.status).toBe('received');
    expect(order.externalOrderId).toBe('partner-1001');
    expect(seen['idempotencyKey']).toBe('partner-1001');
    const again = await submitOrder(payload, {
      secretKey: 'sk_test_server',
      channel: 'rileyspets.com',
    });
    expect(again).toEqual(order);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
