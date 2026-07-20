// Fixture extraction (P1-T07, docs/08 §9): reads the REAL treatink-api seeded catalog package
// (../treatink-api/.../catalog/catalog_v1/catalog.json — the authoritative wire source) and emits
// docs/08 §1–§5 wire JSON under fixtures/catalog/, copying mask + product images alongside.
// Run manually: `node scripts/gen-fixtures.mjs`. Output is committed; re-run only on seed changes.
//
// Wire-shape notes (docs/08 header): PublicDecimal serializes as a JSON float — the seed's
// six-place decimal STRINGS become floats here. Seed label_zone carries extra provenance
// (pixels, reference dims); the wire form is the four normalized floats only (docs/08 §3).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const SEED = '../treatink-api/src/treatink_api/modules/catalog/catalog_v1';
const OUT = 'fixtures';
const EXPIRES_AT = '2026-08-19T00:00:00Z'; // fixed fixture expiry (docs/08 §3 example)

const seed = JSON.parse(readFileSync(join(SEED, 'catalog.json'), 'utf8'));
const num = (v) => (typeof v === 'string' ? Number(v) : v);
const id = (prefix, i) => `${prefix}_fx_${String(i + 1).padStart(8, '0')}`;

const mediaByKey = new Map(seed.media.map((m) => [m.stable_key, m]));

/** MediaResponse (docs/08 §3) from a seed media record; url points at the copied fixture file. */
function mediaWire(key, urlDir) {
  const m = mediaByKey.get(key);
  if (!m) throw new Error(`media key not in seed: ${key}`);
  return {
    url: `/fixtures/${urlDir}/${basename(m.package_path)}`,
    expires_at: EXPIRES_AT,
    content_type: m.content_type,
    size_bytes: m.size_bytes,
    width: m.width,
    height: m.height,
    sha256: m.sha256,
  };
}

function rect(r) {
  const out = {
    pixels: {
      x: num(r.pixels.x),
      y: num(r.pixels.y),
      width: num(r.pixels.width),
      height: num(r.pixels.height),
      right_exclusive: num(r.pixels.right_exclusive),
      bottom_exclusive: num(r.pixels.bottom_exclusive),
    },
    normalized: {
      x: num(r.normalized.x),
      y: num(r.normalized.y),
      width: num(r.normalized.width),
      height: num(r.normalized.height),
    },
  };
  if (r.pixel_count !== undefined) out.pixel_count = r.pixel_count;
  if (r.pixel_area !== undefined) out.pixel_area = r.pixel_area;
  if (r.start_pixel !== undefined) out.start_pixel = r.start_pixel;
  if (r.touches_canvas_edge !== undefined) out.touches_canvas_edge = r.touches_canvas_edge;
  return out;
}

/* ── §1 channel ── */
const channel = {
  id: 'chn_fx_0000000000000000000000000001',
  name: "Riley's Pets",
  mode: 'test',
  key_class: 'publishable',
  permissions: ['artwork_upload', 'catalog_read', 'channel_read'],
};

/* ── §2 products ── */
const productIdByKey = new Map(seed.products.map((p, i) => [p.stable_key, id('prd', i)]));
const products = seed.products.map((p, i) => ({
  id: id('prd', i),
  title: p.title,
  description: p.description,
  animal_type: p.animal_type,
  category: p.category,
  product_type: p.product_type,
  status: p.status,
}));

/* ── §3 variants (SKU lives here) ── */
const variantIdBySku = new Map(seed.variants.map((v, i) => [v.sku, id('var', i)]));
const variants = seed.variants.map((v, i) => ({
  id: id('var', i),
  product_id: productIdByKey.get(v.product_stable_key),
  sku: v.sku,
  description: v.description,
  short_description: v.short_description,
  option_values: v.flavor ? { flavor: v.flavor } : {},
  currency: v.currency,
  suggested_retail_cents: v.suggested_retail_cents,
  availability: v.availability,
  fulfillment_eligibility: v.fulfillment_eligibility,
  catalog_image: mediaWire(v.catalog_media_key, 'products'),
  regulatory_label_image: v.regulatory_label_media_key
    ? mediaWire(v.regulatory_label_media_key, 'product-labels')
    : null,
  label_zone: v.label_zone
    ? {
        x: num(v.label_zone.x),
        y: num(v.label_zone.y),
        width: num(v.label_zone.width),
        height: num(v.label_zone.height),
      }
    : null,
}));

/* ── §4 bundles ── */
const bundles = seed.bundles.map((b, i) => ({
  id: id('bnd', i),
  name: b.name,
  description: b.description,
  animal_type: b.animal_type,
  currency: b.currency,
  raw_total_cents: b.raw_total_cents,
  discount_cents: b.discount_cents,
  suggested_retail_cents: b.suggested_retail_cents,
  variant_ids: b.variant_skus.map((sku) => {
    const vid = variantIdBySku.get(sku);
    if (!vid) throw new Error(`bundle references unknown sku: ${sku}`);
    return vid;
  }),
}));

/* ── §5 cutout labels ── */
const cutoutLabels = seed.cutout_labels.map((c, i) => ({
  id: id('cut', i),
  title: c.title,
  category: c.category,
  theme: c.theme,
  pet_name_position: c.pet_name_position,
  description: c.description,
  tags: c.tags,
  mask: mediaWire(c.mask_media_key, 'cutouts'),
  canvas: c.canvas,
  placement: rect(c.placement),
  alpha_threshold: c.alpha_threshold,
  center_pixel_alpha: c.center_pixel_alpha,
  alpha_stats: {
    total_pixels: c.alpha_stats.total_pixels,
    fully_transparent_pixels: c.alpha_stats.fully_transparent_pixels,
    semitransparent_pixels: c.alpha_stats.semitransparent_pixels,
    opaque_pixels: c.alpha_stats.opaque_pixels,
    fully_transparent_fraction: num(c.alpha_stats.fully_transparent_fraction),
    semitransparent_fraction: num(c.alpha_stats.semitransparent_fraction),
    opaque_fraction: num(c.alpha_stats.opaque_fraction),
  },
  fully_transparent_bounds: rect(c.fully_transparent_bounds),
  non_opaque_bounds: rect(c.non_opaque_bounds),
  center_transparent_component: rect(c.center_transparent_component),
  largest_safe_transparent_rectangle: rect(c.largest_safe_transparent_rectangle),
}));

/* ── write JSON ── */
mkdirSync(join(OUT, 'catalog'), { recursive: true });
const files = { channel, products, variants, bundles, 'cutout-labels': cutoutLabels };
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(OUT, 'catalog', `${name}.json`), JSON.stringify(data, null, 1) + '\n');
}

/* ── copy binary assets (cutout masks + product images; regulatory labels stay in the seed) ── */
let copied = 0;
for (const m of seed.media) {
  const dir = m.role === 'cutout_mask' ? 'cutouts' : m.role === 'catalog_image' ? 'products' : null;
  if (!dir) continue; // regulatory labels (10 MB) are not needed by the designer MVP — see README
  mkdirSync(join(OUT, dir), { recursive: true });
  copyFileSync(join(SEED, m.package_path), join(OUT, dir, basename(m.package_path)));
  copied += 1;
}

console.log(
  `fixtures: ${products.length} products, ${variants.length} variants, ${bundles.length} bundles, ` +
    `${cutoutLabels.length} cutout labels, ${copied} images copied.`,
);
