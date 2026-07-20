import channelJson from '../../fixtures/catalog/channel.json';
import productsJson from '../../fixtures/catalog/products.json';
import variantsJson from '../../fixtures/catalog/variants.json';
import bundlesJson from '../../fixtures/catalog/bundles.json';
import cutoutLabelsJson from '../../fixtures/catalog/cutout-labels.json';
import type {
  ChannelWire,
  CutoutLabelWire,
  FixtureDataset,
  ProductWire,
} from '../transport/fixture-transport.js';

/**
 * The SHIPPED fixture dataset (docs/08 §9): extracted from the real treatink-api seeded catalog
 * by scripts/gen-fixtures.mjs. 11 product families / 14 variants (SKUs) / 1 bundle / 95 cutout
 * labels, incl. the edge cases (null label_zone, storefront-only Riley's, slug-collision frames).
 *
 * IMPORTANT: only load this module via dynamic import — it inlines ~250 KB of catalog JSON and
 * must stay OUT of the loader chunk (docs/06 §2 budget). FixtureTransport lazy-imports it.
 */
export const dataset: FixtureDataset = {
  channel: channelJson as ChannelWire,
  products: productsJson as ProductWire[],
  variants: variantsJson,
  bundles: bundlesJson,
  cutoutLabels: cutoutLabelsJson as CutoutLabelWire[],
};
