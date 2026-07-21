import { expect, test, type Route } from '@playwright/test';
import { submitOrder } from '../../server/index.js';
import type { Treatink } from '../../src/types.js';

/**
 * P4-T01 — HttpTransport against a documented mock of the live contract (docs/04 §1). No staging in
 * this env, so the browser catalog path is exercised via `page.route` returning the exact wire
 * shapes, and the server order path via a fetch stub. Proves: live catalog works, auth is
 * `Bearer pk_…` with NO channel header (docs/04 §2.8), and mode-swap changes nothing above the
 * transport (fixtures ↔ live parity).
 */

declare global {
  interface Window {
    Treatink: { init: (config: unknown) => Treatink };
  }
}

const CHANNEL = {
  id: 'chn_live_1',
  name: 'Riley',
  mode: 'live',
  key_class: 'publishable',
  permissions: ['catalog_read'],
};
const FAMILY = {
  id: 'prd_1',
  title: 'Slim Soft Chew Tin',
  description: 'A tin',
  animal_type: 'dog',
  category: 'treats',
  product_type: 'tin',
  status: 'active',
};
const VARIANT = {
  id: 'var_live_1',
  product_id: 'prd_1',
  sku: 'SSGTTBC',
  description: 'Beef',
  short_description: 'Beef',
  option_values: { flavor: 'beef' },
  currency: 'USD',
  suggested_retail_cents: 999,
  availability: 'in_stock',
  fulfillment_eligibility: { policy: 'standard', country_codes: ['US'] },
  catalog_image: {
    url: 'https://cdn.treatink.com/v/1.png',
    expires_at: '2026-07-20T12:10:00Z',
    content_type: 'image/png',
    size_bytes: 1,
    width: 900,
    height: 1200,
    sha256: 'a'.repeat(64),
  },
  regulatory_label_image: null,
  label_zone: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
};
const pageWire = <T>(data: T[]) => ({ data, has_more: false, next_cursor: null });

test('live catalog works over HttpTransport; auth is Bearer pk with no channel header', async ({
  page,
}) => {
  const captured: Array<{ path: string; headers: Record<string, string> }> = [];
  await page.route('**/v1/**', (route: Route) => {
    const url = new URL(route.request().url());
    captured.push({ path: url.pathname, headers: route.request().headers() });
    if (url.pathname === '/v1/catalog/variants')
      return route.fulfill({ json: pageWire([VARIANT]) });
    if (url.pathname === '/v1/catalog/products') return route.fulfill({ json: pageWire([FAMILY]) });
    if (url.pathname === '/v1/channel') return route.fulfill({ json: CHANNEL });
    return route.fulfill({
      status: 404,
      json: { error: { type: 'invalid_request_error', code: 'not_found', message: 'nope' } },
    });
  });

  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.Treatink));

  const result = await page.evaluate(async () => {
    const tk = window.Treatink.init({
      apiKey: 'pk_test_live',
      channel: 'rileyspets.com',
      mode: 'live',
      apiBaseUrl: window.location.origin,
    });
    const listed = await tk.products.list({ limit: 100 });
    const one = await tk.products.get('SSGTTBC');
    return { first: listed.data[0], one };
  });

  expect(result.first).toMatchObject({
    sku: 'SSGTTBC',
    variantId: 'var_live_1',
    productId: 'prd_1',
    title: 'Slim Soft Chew Tin',
    priceCents: 999,
    currency: 'USD',
    images: { catalogImageUrl: 'https://cdn.treatink.com/v/1.png' },
  });
  expect(result.one.variantId).toBe('var_live_1');

  // Auth is Bearer pk on every call; the channel is NEVER a request header (docs/04 §2.8).
  const variantsCall = captured.find((c) => c.path === '/v1/catalog/variants')!;
  expect(variantsCall.headers['authorization']).toBe('Bearer pk_test_live');
  expect(Object.keys(variantsCall.headers)).not.toContain('x-treatink-channel');
});

test('mode swap changes nothing above the transport (fixtures ↔ live parity)', async ({ page }) => {
  await page.route('**/v1/**', (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/v1/catalog/variants')
      return route.fulfill({ json: pageWire([VARIANT]) });
    if (url.pathname === '/v1/catalog/products') return route.fulfill({ json: pageWire([FAMILY]) });
    return route.fulfill({ json: pageWire([]) });
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.Treatink));

  // The SAME consumer code runs against both transports; only init() differs.
  const { fixtureKeys, liveKeys, sameSku } = await page.evaluate(async () => {
    const load = (tk: Treatink) => tk.products.get('SSGTTBC');
    const fx = await load(
      window.Treatink.init({ apiKey: 'pk_test_x', channel: 'rileyspets.com', mode: 'fixtures' }),
    );
    const live = await load(
      window.Treatink.init({
        apiKey: 'pk_test_x',
        channel: 'rileyspets.com',
        mode: 'live',
        apiBaseUrl: window.location.origin,
      }),
    );
    return {
      fixtureKeys: Object.keys(fx).sort(),
      liveKeys: Object.keys(live).sort(),
      sameSku: fx.sku === live.sku && live.sku === 'SSGTTBC',
    };
  });

  expect(sameSku).toBe(true);
  expect(liveKeys).toEqual(fixtureKeys); // identical public Product shape from either transport
});

test('server submitOrder posts the live order path with Bearer sk + Idempotency-Key', async () => {
  const seen: Record<string, unknown> = {};
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input: unknown, init?: RequestInit): Promise<Response> => {
    seen['url'] = String(input);
    seen['method'] = init?.method;
    seen['auth'] = (init?.headers as Record<string, string>)['Authorization'];
    seen['idempotencyKey'] = (init?.headers as Record<string, string>)['Idempotency-Key'];
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: 'ord_live_1',
          order_number: '1001',
          status: 'received',
          external_order_id: 'partner-1',
        }),
        { status: 201 },
      ),
    );
  };
  try {
    const payload = { external_order_id: 'partner-1', line_items: [] } as unknown as Parameters<
      typeof submitOrder
    >[0];
    const order = await submitOrder(payload, {
      secretKey: 'sk_test_x',
      channel: 'rileyspets.com',
      apiBaseUrl: 'https://api.treatink.test',
    });
    expect(order.status).toBe('received');
    expect(seen['url']).toBe('https://api.treatink.test/v1/orders');
    expect(seen['method']).toBe('POST');
    expect(seen['auth']).toBe('Bearer sk_test_x');
    expect(seen['idempotencyKey']).toBe('partner-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('server submitOrder maps an error envelope to a TreatinkError', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          error: {
            type: 'invalid_request_error',
            code: 'validation_error',
            message: 'bad',
            param: 'currency',
            request_id: 'req_live_2',
          },
        }),
        { status: 422 },
      ),
    );
  try {
    const payload = { external_order_id: 'partner-2', line_items: [] } as unknown as Parameters<
      typeof submitOrder
    >[0];
    await expect(
      submitOrder(payload, { secretKey: 'sk_test_x', channel: 'rileyspets.com' }),
    ).rejects.toMatchObject({ code: 'validation_error', status: 422, param: 'currency' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
