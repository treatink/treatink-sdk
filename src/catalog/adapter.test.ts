import { describe, expect, it } from 'vitest';
import { FixtureTransport } from '../transport/fixture-transport.js';
import { dataset } from './fixture-dataset.js';
import { TreatinkError } from '../types.js';

// P1-T07: products.get(sku) and templates.list({sku}) return normalized internal models;
// edge-case fixtures load without error. Data extracted from the real treatink-api seed
// (scripts/gen-fixtures.mjs).

describe('shipped fixture dataset (docs/08 §9)', () => {
  it('loads the full extraction: 11 families, 14 SKUs, 1 bundle, 95 cutout labels', () => {
    expect(dataset.products).toHaveLength(11);
    expect(dataset.variants).toHaveLength(14);
    expect(dataset.bundles).toHaveLength(1);
    expect(dataset.cutoutLabels).toHaveLength(95);
  });

  it('carries the edge cases: null zones, storefront-only Riley product, slug-collision frames', () => {
    const nullZones = dataset.variants.filter((v) => v.label_zone === null).map((v) => v.sku);
    expect(nullZones).toEqual(
      expect.arrayContaining(['SLP-00018', 'SLP-00026', 'RILEY-BISCUITS-PB']),
    );
    expect(dataset.variants.some((v) => v.sku === 'RILEY-BISCUITS-PB')).toBe(true);
    // the seed's source-name collision cluster survives extraction as distinct labels
    const holidayTitles = dataset.cutoutLabels.filter((c) =>
      /^Holidays Frame 2[567]$/.test(c.title),
    );
    expect(holidayTitles).toHaveLength(3);
    // animal variety (docs/08 §9): all three types present
    expect(new Set(dataset.products.map((p) => p.animal_type))).toEqual(
      new Set(['cat', 'dog', 'horse']),
    );
  });

  it('serializes normalized geometry as floats, not decimal strings (docs/08 header)', () => {
    const c = dataset.cutoutLabels[0]!;
    expect(c.fully_transparent_bounds.normalized.x).toBeTypeOf('number');
    expect(c.alpha_stats.fully_transparent_fraction).toBeTypeOf('number');
    expect(c.canvas).toEqual({ width: 900, height: 1200 });
    expect(c.alpha_threshold).toBe(8);
  });
});

describe('products.get(sku) — variant joined to family (docs/04 §2.4)', () => {
  it('returns the normalized public Product', async () => {
    const t = new FixtureTransport();
    const p = await t.getProduct('SSGTTBC');
    expect(p.sku).toBe('SSGTTBC');
    expect(p.variantId).toMatch(/^var_fx_/);
    expect(p.productId).toMatch(/^prd_fx_/);
    expect(p.title).toBeTypeOf('string');
    expect(p.priceCents).toBeGreaterThan(0);
    expect(p.currency).toBe('USD');
    expect(p.status).toBe('active');
    expect(p.images.catalogImageUrl).toMatch(/^\/fixtures\/products\//);
    expect(p.labelZone).not.toBeNull();
    expect(p.labelZone!.x).toBeTypeOf('number');
    expect(p.labelZone!.width).toBeGreaterThan(0);
  });

  it('no-zone edge case: labelZone is null', async () => {
    const t = new FixtureTransport();
    for (const sku of ['SLP-00018', 'RILEY-BISCUITS-PB']) {
      const p = await t.getProduct(sku);
      expect(p.labelZone).toBeNull();
    }
  });

  it('unknown sku → not_found', async () => {
    const t = new FixtureTransport();
    const err = await t.getProduct('NO-SUCH-SKU').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TreatinkError);
    expect((err as TreatinkError).code).toBe('not_found');
    expect((err as TreatinkError).status).toBe(404);
  });

  it('products.list pages every SKU as one product', async () => {
    const t = new FixtureTransport();
    const page = await t.listProducts({ limit: 100 });
    expect(page.data).toHaveLength(14);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
    expect(new Set(page.data.map((p) => p.sku)).size).toBe(14);
  });
});

describe('templates.list({ sku }) — normalized cutout labels (docs/10 §5)', () => {
  it('returns Template models with consumable opening geometry', async () => {
    const t = new FixtureTransport();
    const page = await t.listTemplates({ sku: 'SSGTTBC', limit: 5 });
    expect(page.data).toHaveLength(5);
    expect(page.hasMore).toBe(true);
    const tpl = page.data[0]!;
    expect(tpl.cutoutLabelId).toMatch(/^cut_fx_/);
    expect(['standard', 'holidays', 'birthdays', 'occasions']).toContain(tpl.category);
    expect(['light', 'dark']).toContain(tpl.theme);
    expect(['default', 'top', 'upper', 'bottom']).toContain(tpl.petNamePosition);
    expect(tpl.maskUrl).toMatch(/^\/fixtures\/cutouts\/.+\.png$/);
    expect(tpl.canvas).toEqual({ width: 900, height: 1200 });
    expect(tpl.opening.alphaThreshold).toBe(8);
    expect(tpl.opening.fullyTransparentBounds.pixels.width).toBeGreaterThan(0);
    expect(tpl.opening.fullyTransparentBounds.normalized.x).toBeLessThanOrEqual(1);
    expect(tpl.opening.centerTransparentComponent.touchesCanvasEdge).toBe(false);
    expect(tpl.opening.largestSafeTransparentRectangle.pixelCount).toBeGreaterThan(0);
    expect(tpl.maxTextLength).toBeUndefined(); // falls back to config (docs/10 §5)
  });

  it('walks all 95 labels via cursor paging', async () => {
    const t = new FixtureTransport();
    const seen: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await t.listTemplates({
        sku: 'SSGTTBC',
        limit: 40,
        ...(cursor ? { cursor } : {}),
      });
      seen.push(...page.data.map((d) => d.cutoutLabelId));
      if (!page.hasMore) break;
      cursor = page.nextCursor as string;
    }
    expect(seen).toHaveLength(95);
    expect(new Set(seen).size).toBe(95);
  });
});

describe('channel (normalized)', () => {
  it('camel-cases the wire shape', async () => {
    const t = new FixtureTransport();
    const c = await t.getChannel();
    expect(c.keyClass).toBe('publishable');
    expect(c.permissions).toContain('catalog_read');
  });
});
