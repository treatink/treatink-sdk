import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FixtureTransport,
  buildEnvelope,
  errorTypeForStatus,
  type ArtworkCreateRequestWire,
  type ProductWire,
} from './fixture-transport.js';
import { TreatinkError } from '../types.js';

// P1-T06: fixture calls return docs/08-shaped objects; failNext yields the exact TreatinkError;
// uploads never hit the network.

const DECLARE: ArtworkCreateRequestWire = {
  role: 'source',
  content_type: 'image/png',
  size_bytes: 2_456_789,
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
};

function products(n: number): ProductWire[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `prd_fx_${String(i + 1).padStart(8, '0')}`,
    title: `Product ${i + 1}`,
    description: '…',
    animal_type: 'dog' as const,
    category: 'treats',
    product_type: 'treats',
    status: 'active',
  }));
}

describe('channel (docs/08 §1)', () => {
  it('returns the exact ChannelResponse shape', async () => {
    const t = new FixtureTransport();
    const channel = await t.channel();
    expect(Object.keys(channel).sort()).toEqual(['id', 'key_class', 'mode', 'name', 'permissions']);
    expect(channel.key_class).toBe('publishable');
    expect(channel.mode).toBe('test');
  });
});

describe('catalog pagination (docs/08 §0 CatalogPage)', () => {
  it('pages with default limit 20 and cursor round-trip', async () => {
    const t = new FixtureTransport({ data: { products: products(25) } });
    const page1 = await t.catalogProducts();
    expect(page1.data).toHaveLength(20);
    expect(page1.has_more).toBe(true);
    expect(page1.next_cursor).toBeTypeOf('string');

    const page2 = await t.catalogProducts({ cursor: page1.next_cursor as string });
    expect(page2.data).toHaveLength(5);
    expect(page2.has_more).toBe(false);
    expect(page2.next_cursor).toBeNull();
    expect(page2.data[0]!.id).toBe('prd_fx_00000021');
  });

  it('rejects limit out of 1–100 with validation_error', async () => {
    const t = new FixtureTransport();
    for (const limit of [0, 101, 2.5]) {
      const err = await t.catalogProducts({ limit }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(TreatinkError);
      expect((err as TreatinkError).code).toBe('validation_error');
      expect((err as TreatinkError).status).toBe(422);
      expect((err as TreatinkError).param).toBe('limit');
    }
  });

  it('rejects a malformed cursor with invalid_cursor 400', async () => {
    const t = new FixtureTransport();
    const err = await t.catalogProducts({ cursor: 'nonsense' }).catch((e: unknown) => e);
    expect((err as TreatinkError).code).toBe('invalid_cursor');
    expect((err as TreatinkError).status).toBe(400);
    expect((err as TreatinkError).param).toBe('cursor');
  });
});

describe('two-step asset flow (docs/08 §6)', () => {
  it('declare → PUT → finalize returns exact wire shapes, no url on final', async () => {
    const t = new FixtureTransport();
    const pending = await t.assetsDeclare(DECLARE);
    expect(pending.id).toMatch(/^ast_fx_/);
    expect(pending.status).toBe('pending');
    expect(pending.upload.method).toBe('PUT');
    expect(pending.upload.headers).toEqual({ 'Content-Type': 'image/png' });
    expect(pending.pending_expires_at).toBeTypeOf('string');

    await t.assetsPut(pending.upload, new Blob(['x'], { type: 'image/png' }));
    const final = await t.assetsFinalize(pending.id);
    expect(final.status).toBe('final');
    expect(final.id).toBe(pending.id);
    expect(final.width).toBeGreaterThan(0);
    expect(final.height).toBeGreaterThan(0);
    expect(final.finalized_at).toBeTypeOf('string');
    expect('url' in final).toBe(false); // GP-08: finalize returns NO url
    expect('upload' in final).toBe(false);
  });

  it('finalize before PUT → 409 upload_incomplete; unknown id → 404 not_found', async () => {
    const t = new FixtureTransport();
    const pending = await t.assetsDeclare(DECLARE);
    const early = await t.assetsFinalize(pending.id).catch((e: unknown) => e);
    expect((early as TreatinkError).code).toBe('upload_incomplete');
    expect((early as TreatinkError).status).toBe(409);

    const missing = await t.assetsFinalize('ast_fx_nope').catch((e: unknown) => e);
    expect((missing as TreatinkError).code).toBe('not_found');
    expect((missing as TreatinkError).status).toBe(404);
  });

  it('validates declare: role, content_type, size, sha256', async () => {
    const t = new FixtureTransport();
    const cases: Array<[Partial<ArtworkCreateRequestWire>, string, number]> = [
      [{ role: 'weird' as never }, 'validation_error', 422],
      [{ content_type: 'image/gif' }, 'unsupported_media_type', 415],
      [{ size_bytes: 60_000_000 }, 'upload_too_large', 413],
      [{ size_bytes: -1 }, 'validation_error', 422],
      [{ sha256: 'nothex' }, 'validation_error', 422],
    ];
    for (const [patch, code, status] of cases) {
      const err = await t.assetsDeclare({ ...DECLARE, ...patch }).catch((e: unknown) => e);
      expect((err as TreatinkError).code, JSON.stringify(patch)).toBe(code);
      expect((err as TreatinkError).status).toBe(status);
    }
  });

  it('never touches the network: full flow with fetch poisoned', async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('network hit!');
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const t = new FixtureTransport();
      const pending = await t.assetsDeclare(DECLARE);
      await t.assetsPut(pending.upload, new Blob(['x'], { type: 'image/png' }));
      await t.assetsFinalize(pending.id);
      await t.channel();
      await t.catalogCutoutLabels();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('failNext (Charter §11, docs/08 §8)', () => {
  it('fails exactly the next call to the op with the mapped envelope error', async () => {
    const t = new FixtureTransport();
    const pending = await t.assetsDeclare(DECLARE);
    await t.assetsPut(pending.upload, new Blob(['x'], { type: 'image/png' }));

    t.failNext('assets.finalize', { status: 422, code: 'upload_validation_failed' });
    const err = await t.assetsFinalize(pending.id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TreatinkError);
    expect((err as TreatinkError).code).toBe('upload_validation_failed');
    expect((err as TreatinkError).status).toBe(422);
    expect((err as TreatinkError).requestId).toMatch(/^req_fx_\d{6}$/);

    // the failure is consumed — the retry succeeds
    const final = await t.assetsFinalize(pending.id);
    expect(final.status).toBe('final');
  });

  it('SDK-local upload_failed surfaces without a wire request id (browser-PUT path)', async () => {
    const t = new FixtureTransport();
    const pending = await t.assetsDeclare(DECLARE);
    t.failNext('assets.put', { status: 0, code: 'upload_failed' });
    const err = await t
      .assetsPut(pending.upload, new Blob(['x'], { type: 'image/png' }))
      .catch((e: unknown) => e);
    expect((err as TreatinkError).code).toBe('upload_failed');
    expect((err as TreatinkError).requestId).toBeUndefined();
  });

  it('builds the docs/08 §8 envelope with the errors.py type per class', () => {
    expect(errorTypeForStatus(400)).toBe('invalid_request_error');
    expect(errorTypeForStatus(401)).toBe('authentication_error');
    expect(errorTypeForStatus(403)).toBe('permission_error');
    expect(errorTypeForStatus(422)).toBe('invalid_request_error');
    expect(errorTypeForStatus(503)).toBe('api_error');

    const envelope = buildEnvelope(413, 'upload_too_large', 'req_fx_000001');
    expect(envelope).toEqual({
      error: {
        type: 'invalid_request_error',
        code: 'upload_too_large',
        message: 'The upload exceeds the allowed size.',
        param: 'size_bytes',
        request_id: 'req_fx_000001',
      },
    });
  });
});

describe('order echo (docs/08 §7 — real OrderResponse essentials)', () => {
  const BODY = {
    external_order_id: 'partner-1001',
    display_order_number: '#1001',
    currency: 'USD',
    line_items: [{ external_line_item_id: 'li-1', variant_id: 'var_fx_1', quantity: 1 }],
  };

  it('echoes an accepted order', async () => {
    const t = new FixtureTransport();
    const order = await t.ordersSubmit(BODY);
    expect(order.id).toMatch(/^ord_fx_/);
    expect(order.status).toBe('received');
    expect(order.external_order_id).toBe('partner-1001');
    expect(order.display_order_number).toBe('#1001');
    expect(order.line_items).toHaveLength(1);
    expect(order.line_items[0]!.variant_id).toBe('var_fx_1');
  });

  it('is idempotent on external_order_id', async () => {
    const t = new FixtureTransport();
    const first = await t.ordersSubmit(BODY);
    const again = await t.ordersSubmit(BODY);
    expect(again).toEqual(first);
  });
});

describe('latency (Charter §11)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('setLatency delays operations', async () => {
    const t = new FixtureTransport();
    t.setLatency(500);
    let resolved = false;
    const call = t.channel().then((c) => {
      resolved = true;
      return c;
    });
    await vi.advanceTimersByTimeAsync(400);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    await call;
    expect(resolved).toBe(true);
  });
});

describe('tk.fixtures wiring (docs/10 §3)', () => {
  it('exposes failNext + setLatency on the instance in fixtures mode', async () => {
    const { Treatink } = await import('../index.js');
    const tk = Treatink.init({ apiKey: 'pk_test_x', channel: 'rileyspets.com' });
    expect(tk.fixtures).toBeDefined();
    expect(() =>
      tk.fixtures!.failNext('assets.finalize', { status: 422, code: 'x' }),
    ).not.toThrow();
    expect(() => tk.fixtures!.setLatency(0)).not.toThrow();
  });
});
