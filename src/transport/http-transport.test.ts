import { describe, expect, it } from 'vitest';
import { HttpTransport } from './http-transport.js';
import { TreatinkError } from '../types.js';

/**
 * P4-T01 — HttpTransport against a stubbed `fetch` implementing the documented live contract
 * (docs/04 §1). Covers the transport internals that are awkward to reach through the browser e2e:
 * auth header shape, the no-channel-header rule (docs/04 §2.8), envelope→TreatinkError mapping, and
 * bounded retry/backoff on transient failures. Sleep + jitter are injected so retries are instant
 * and deterministic.
 */

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

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const page = <T>(data: T[]): { data: T[]; has_more: boolean; next_cursor: null } => ({
  data,
  has_more: false,
  next_cursor: null,
});

/** Queue entry: a canned response, or 'network-error' to simulate a failed fetch. */
type Step = Response | 'network-error';

/** A fetch stub that replays queued steps and records every call. */
function stubFetch(steps: Step[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let i = 0;
  const fn = (input: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url: input, ...(init ? { init } : {}) });
    const step = steps[Math.min(i++, steps.length - 1)]!;
    if (step === 'network-error') return Promise.reject(new TypeError('network down'));
    return Promise.resolve(step);
  };
  return { fetch: fn as unknown as typeof fetch, calls };
}

function make(steps: Step[], opts?: { maxRetries?: number }) {
  const { fetch, calls } = stubFetch(steps);
  const transport = new HttpTransport({
    apiKey: 'pk_test_abc',
    apiBaseUrl: 'https://api.treatink.test/',
    fetch,
    sleep: () => Promise.resolve(),
    random: () => 0,
    ...(opts?.maxRetries !== undefined ? { maxRetries: opts.maxRetries } : {}),
  });
  return { transport, calls };
}

describe('HttpTransport', () => {
  it('sends Bearer auth and NO channel header, and normalizes the channel', async () => {
    const { transport, calls } = make([json(200, CHANNEL)]);
    const channel = await transport.getChannel();

    expect(calls[0]!.url).toBe('https://api.treatink.test/v1/channel');
    const headers = calls[0]!.init!.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer pk_test_abc');
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('x-treatink-channel');
    expect(channel).toEqual({
      id: 'chn_live_1',
      name: 'Riley',
      mode: 'live',
      keyClass: 'publishable',
      permissions: ['catalog_read'],
    });
  });

  it('joins variants to families into the public Product shape', async () => {
    const { transport, calls } = make([json(200, page([VARIANT])), json(200, page([FAMILY]))]);
    const listed = await transport.listProducts({ limit: 100 });

    expect(calls[0]!.url).toBe('https://api.treatink.test/v1/catalog/variants?limit=100');
    expect(calls[1]!.url).toBe('https://api.treatink.test/v1/catalog/products?limit=100');
    expect(listed.data[0]).toMatchObject({
      sku: 'SSGTTBC',
      variantId: 'var_live_1',
      productId: 'prd_1',
      title: 'Slim Soft Chew Tin',
      priceCents: 999,
      currency: 'USD',
      images: { catalogImageUrl: 'https://cdn.treatink.com/v/1.png' },
    });
    expect(listed.data[0]!.labelZone).toEqual({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
  });

  it('getProduct resolves a SKU; an unknown SKU is not_found (404, param sku)', async () => {
    const { transport } = make([json(200, page([VARIANT])), json(200, page([FAMILY]))]);
    expect((await transport.getProduct('SSGTTBC')).variantId).toBe('var_live_1');

    const missing = make([json(200, page([VARIANT]))]);
    await expect(missing.transport.getProduct('NOPE')).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
      param: 'sku',
    });
    expect(missing.calls).toHaveLength(1); // no family fetch once the SKU misses
  });

  it('maps the API error envelope to a TreatinkError (code, param, status, requestId)', async () => {
    const { transport } = make([
      json(422, {
        error: {
          type: 'invalid_request_error',
          code: 'validation_error',
          message: 'The request is invalid.',
          param: 'limit',
          request_id: 'req_live_9',
        },
      }),
    ]);
    const err = await transport.listProducts({ limit: 999 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TreatinkError);
    expect(err).toMatchObject({
      code: 'validation_error',
      status: 422,
      param: 'limit',
      requestId: 'req_live_9',
    });
  });

  it('retries idempotent GETs on 503, then succeeds', async () => {
    const { transport, calls } = make([
      json(503, { error: { type: 'api_error', code: 'service_unavailable', message: 'down' } }),
      json(200, CHANNEL),
    ]);
    expect((await transport.getChannel()).id).toBe('chn_live_1');
    expect(calls).toHaveLength(2); // one retry
  });

  it('retries network failures, then gives up as service_unavailable', async () => {
    const { transport, calls } = make(['network-error', 'network-error', 'network-error'], {
      maxRetries: 2,
    });
    await expect(transport.getChannel()).rejects.toMatchObject({ code: 'service_unavailable' });
    expect(calls).toHaveLength(3); // initial + 2 retries
  });

  it('does NOT retry a 404 (non-transient) — one call, then throws', async () => {
    const { transport, calls } = make([
      json(404, { error: { type: 'invalid_request_error', code: 'not_found', message: 'nope' } }),
    ]);
    await expect(transport.getChannel()).rejects.toMatchObject({ code: 'not_found', status: 404 });
    expect(calls).toHaveLength(1);
  });
});
