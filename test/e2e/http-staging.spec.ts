import { expect, test } from '@playwright/test';
import { submitOrder } from '../../server/index.js';
import type { Treatink } from '../../src/types.js';

/**
 * P4-T02/T03/T04 — REAL staging verification (staging.treatinkapi.com). Runs only when
 * credentials are provided via env; skipped (not failed) otherwise, so CI stays green:
 *
 *   TREATINK_PK=pk_test_…  TREATINK_SK=sk_test_…  npm run test:staging
 *
 * Env:
 *   TREATINK_STAGING_URL   base URL (default https://staging.treatinkapi.com)
 *   TREATINK_PK            publishable key (browser paths: channel/catalog/assets)
 *   TREATINK_SK            secret key (server order submit; optional)
 *   TREATINK_STAGING_ORDERS=1  opt-in: actually create a staging order (writes data)
 *
 * What this proves (the parked P4 gates):
 *   - machine CORS from a foreign origin (harness localhost) with Bearer pk — P4-T04
 *   - live catalog + cutout-labels (templates) — P4-T03
 *   - the browser PUT to real presigned object storage (declare→PUT→finalize) — P4-T02
 *   - POST /v1/orders with Idempotency-Key over real finalized assets — opt-in
 * Keys come ONLY from env — never hardcode credentials in this repo (docs/11 §1).
 */

const STAGING_URL = process.env['TREATINK_STAGING_URL'] ?? 'https://staging.treatinkapi.com';
const PK = process.env['TREATINK_PK'];
const SK = process.env['TREATINK_SK'];
const ORDERS_OPT_IN = process.env['TREATINK_STAGING_ORDERS'] === '1';

declare global {
  interface Window {
    Treatink: { init: (config: unknown) => Treatink };
  }
}

test.describe('staging smoke (live wire, real keys)', () => {
  test.skip(!PK, 'set TREATINK_PK (and optionally TREATINK_SK) to run staging tests');
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.Treatink));
  });

  test('catalog + templates from a foreign origin (pk, wildcard machine CORS)', async ({
    page,
  }) => {
    const result = await page.evaluate(
      async ({ pk, baseUrl }) => {
        const tk = window.Treatink.init({
          apiKey: pk,
          channel: 'staging-smoke.example',
          mode: 'live',
          apiBaseUrl: baseUrl,
        });
        const products = await tk.products.list({ limit: 5 });
        const first = products.data[0]!;
        const templates = await tk.templates.list({ sku: first.sku, limit: 5 });
        return {
          productCount: products.data.length,
          firstVariantId: first.variantId,
          firstSku: first.sku,
          templateCount: templates.data.length,
          firstCutoutId: templates.data[0]?.cutoutLabelId ?? null,
          firstMaskUrl: templates.data[0]?.maskUrl ?? null,
        };
      },
      { pk: PK!, baseUrl: STAGING_URL },
    );
    expect(result.productCount).toBeGreaterThan(0);
    expect(result.firstVariantId).toMatch(/^var_[0-9a-f]{32}$/);
    expect(result.templateCount).toBeGreaterThan(0); // P4-T03: cutout-labels served live
    expect(result.firstCutoutId).toMatch(/^cut_[0-9a-f]{32}$/);
    expect(result.firstMaskUrl).toMatch(/^https:/);
  });

  test('two-step asset upload: declare → browser PUT to object storage → finalize (P4-T02)', async ({
    page,
  }) => {
    const asset = await page.evaluate(
      async ({ pk, baseUrl }) => {
        const tk = window.Treatink.init({
          apiKey: pk,
          channel: 'staging-smoke.example',
          mode: 'live',
          apiBaseUrl: baseUrl,
        });
        // deterministic small PNG rendered in-page
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#a99cdf';
        ctx.fillRect(0, 0, 64, 64);
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), 'image/png'),
        );
        const uploaded = await tk.artwork.upload({ role: 'source', file: blob });
        return uploaded;
      },
      { pk: PK!, baseUrl: STAGING_URL },
    );
    // The whole point of P4-T02: the browser PUT against real presigned storage succeeded.
    expect(asset.id).toMatch(/^ast_[0-9a-f]{32}$/);
    expect(asset.status).toBe('final');
    expect(asset.width).toBe(64);
    expect(asset.height).toBe(64);
  });

  test('order submit over real assets (sk, Idempotency-Key) — OPT-IN, writes staging data', async ({
    page,
  }) => {
    test.skip(!SK, 'set TREATINK_SK to run the order-submit staging test');
    test.skip(!ORDERS_OPT_IN, 'set TREATINK_STAGING_ORDERS=1 to allow creating a staging order');

    // Browser side: real variant + two finalized assets.
    const staged = await page.evaluate(
      async ({ pk, baseUrl }) => {
        const tk = window.Treatink.init({
          apiKey: pk,
          channel: 'staging-smoke.example',
          mode: 'live',
          apiBaseUrl: baseUrl,
        });
        const products = await tk.products.list({ limit: 1 });
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        canvas.getContext('2d')!.fillRect(0, 0, 64, 64);
        const blob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), 'image/png'),
        );
        const source = await tk.artwork.upload({ role: 'source', file: blob });
        const rendered = await tk.artwork.upload({ role: 'rendered', file: blob });
        return { variantId: products.data[0]!.variantId, source: source.id, rendered: rendered.id };
      },
      { pk: PK!, baseUrl: STAGING_URL },
    );

    // Node side: the secret-key submit — the exact strict wire body with explicit nulls.
    const externalOrderId = `sdk-staging-${Date.now()}`;
    const payload = {
      external_order_id: externalOrderId,
      display_order_number: null,
      currency: 'USD',
      recipient: { name: 'SDK Staging Smoke', email: 'sdk-staging@example.com', phone: null },
      destination: {
        address_line_1: '1 Test St',
        address_line_2: null,
        city: 'Austin',
        region: 'TX',
        postal_code: '78701',
        country_code: 'US',
      },
      fulfillment: { delivery_method: 'ship_to_recipient', instructions: null },
      amounts: {
        subtotal_cents: 999,
        discount_cents: 0,
        shipping_cents: 295,
        tax_cents: 0,
        total_cents: 1294,
      },
      line_items: [
        {
          external_line_item_id: 'li-1',
          variant_id: staged.variantId,
          quantity: 1,
          unit_price_cents: 999,
          subtotal_cents: 999,
          personalization: {
            source_asset_id: staged.source,
            rendered_asset_id: staged.rendered,
            cutout_label_id: null,
            pet_name: 'Milo',
          },
        },
      ],
    };
    const order = await submitOrder(payload, {
      secretKey: SK!,
      channel: 'staging-smoke.example',
      apiBaseUrl: STAGING_URL,
    });
    expect(order.id).toMatch(/^ord_/);
    expect(order.status).toBe('received');
    expect(order.externalOrderId).toBe(externalOrderId);

    // Idempotent replay: same Idempotency-Key (default = external_order_id) + same body.
    const replay = await submitOrder(payload, {
      secretKey: SK!,
      channel: 'staging-smoke.example',
      apiBaseUrl: STAGING_URL,
    });
    expect(replay.id).toBe(order.id);
  });
});
