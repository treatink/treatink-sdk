import { describe, expect, it } from 'vitest';
import { Treatink } from '../index.js';
import { TreatinkError } from '../types.js';

// P1-T08: each namespace works end to end against FixtureTransport; invalid file →
// unsupported_file_type; oversize rejected before "network"; surface matches docs/10.

const tk = () => Treatink.init({ apiKey: 'pk_test_x', channel: 'rileyspets.com' });

const PNG = (bytes: BlobPart[] = ['fake-png-bytes']) => new Blob(bytes, { type: 'image/png' });

describe('surface (docs/10 §2–§3)', () => {
  it('exposes exactly the contract namespaces', () => {
    const t = tk();
    expect(Object.keys(t).sort()).toEqual([
      'artwork',
      'designer',
      'drafts',
      'fixtures',
      'on',
      'orders',
      'products',
      'templates',
    ]);
    expect(typeof t.products.list).toBe('function');
    expect(typeof t.products.get).toBe('function');
    expect(typeof t.templates.list).toBe('function');
    expect(typeof t.artwork.upload).toBe('function');
    expect(typeof t.orders.buildPayload).toBe('function');
  });
});

describe('tk.products / tk.templates (fixtures-backed)', () => {
  it('lists and gets products end to end', async () => {
    const t = tk();
    const page = await t.products.list({ limit: 3 });
    expect(page.data).toHaveLength(3);
    expect(page.hasMore).toBe(true);
    const product = await t.products.get('SSGTTBC');
    expect(product.sku).toBe('SSGTTBC');
    expect(product.variantId).toMatch(/^var_fx_/);
  });

  it('lists templates end to end', async () => {
    const t = tk();
    const page = await t.templates.list({ sku: 'SSGTTBC', limit: 10 });
    expect(page.data).toHaveLength(10);
    expect(page.data[0]!.cutoutLabelId).toMatch(/^cut_fx_/);
  });

  it('surfaces fixture failures through the namespaces (failNext)', async () => {
    const t = tk();
    t.fixtures!.failNext('variants.list', { status: 503, code: 'service_unavailable' });
    const err = await t.products.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TreatinkError);
    expect((err as TreatinkError).code).toBe('service_unavailable');
  });
});

describe('tk.artwork.upload — two-step flow with client-side validation', () => {
  it('uploads end to end and returns the final asset with a computed sha256', async () => {
    const t = tk();
    const file = PNG(['deterministic-bytes']);
    const asset = await t.artwork.upload({ role: 'source', file });
    expect(asset.id).toMatch(/^ast_fx_/);
    expect(asset.status).toBe('final');
    expect(asset.role).toBe('source');
    expect(asset.contentType).toBe('image/png');
    // sha256 was computed client-side from the actual bytes
    const expected = await crypto.subtle.digest(
      'SHA-256',
      await new Blob(['deterministic-bytes']).arrayBuffer(),
    );
    const hex = [...new Uint8Array(expected)].map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(asset.sha256).toBe(hex);
  });

  it('rejects an invalid type with unsupported_file_type (SDK-local, before declare)', async () => {
    const t = tk();
    const err = await t.artwork
      .upload({ role: 'source', file: new Blob(['x'], { type: 'text/plain' }) })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TreatinkError);
    expect((err as TreatinkError).code).toBe('unsupported_file_type');
  });

  it('rejects >25 MB before any "network" call (armed declare failure stays armed)', async () => {
    const t = tk();
    t.fixtures!.failNext('assets.declare', { status: 503, code: 'service_unavailable' });

    const big = new Blob([new ArrayBuffer(25_000_001)], { type: 'image/png' });
    const err = await t.artwork.upload({ role: 'source', file: big }).catch((e: unknown) => e);
    expect((err as TreatinkError).code).toBe('upload_too_large');
    expect((err as TreatinkError).status).toBe(413);

    // proof the oversize attempt never reached declare: the armed failure fires only now
    const later = await t.artwork.upload({ role: 'source', file: PNG() }).catch((e: unknown) => e);
    expect((later as TreatinkError).code).toBe('service_unavailable');
  });

  it('surfaces upload_failed from the browser-PUT path without retrying', async () => {
    const t = tk();
    t.fixtures!.failNext('assets.put', { status: 0, code: 'upload_failed' });
    const err = await t.artwork.upload({ role: 'rendered', file: PNG() }).catch((e: unknown) => e);
    expect((err as TreatinkError).code).toBe('upload_failed');
    // a fresh attempt succeeds (failure consumed exactly once — no hidden retry consumed it)
    const asset = await t.artwork.upload({ role: 'rendered', file: PNG() });
    expect(asset.status).toBe('final');
  });
});
