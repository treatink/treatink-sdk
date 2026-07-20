import type {
  LabelZone,
  OpeningGeometry,
  Page,
  Product,
  RectWithCount,
  Template,
} from '../types.js';
import type {
  CatalogPageWire,
  CutoutLabelWire,
  ProductWire,
  RectWire,
  VariantWire,
} from '../transport/fixture-transport.js';

/**
 * The catalog adapter (docs/01 §5): wire shape in → stable internal model out. All catalog parsing
 * lives HERE so schema churn before publication is a one-file edit. The critical modeling move
 * (docs/04 §2.4): a Charter "product with a SKU" is a live **variant** — the adapter joins a
 * variant to its product family and exposes the Charter-shaped `Product`.
 */

/** Join one variant (SKU carrier) with its family → the public Product (docs/10 §5). */
export function toProduct(variant: VariantWire, family: ProductWire): Product {
  return {
    sku: variant.sku,
    variantId: variant.id,
    productId: family.id,
    title: family.title,
    ...(variant.description !== '' ? { description: variant.description } : {}),
    animalType: family.animal_type,
    category: family.category,
    productType: family.product_type,
    status: family.status,
    priceCents: variant.suggested_retail_cents,
    currency: variant.currency,
    images: {
      catalogImageUrl: variant.catalog_image.url,
      ...(variant.regulatory_label_image
        ? { regulatoryLabelUrl: variant.regulatory_label_image.url }
        : {}),
    },
    labelZone: variant.label_zone ? toLabelZone(variant.label_zone) : null,
  };
}

/** A cutout label → the public Template (docs/10 §5). Geometry is consumed, never decoded. */
export function toTemplate(wire: CutoutLabelWire): Template {
  return {
    cutoutLabelId: wire.id,
    title: wire.title,
    category: wire.category,
    theme: wire.theme,
    petNamePosition: wire.pet_name_position,
    tags: wire.tags,
    maskUrl: wire.mask.url,
    canvas: { width: 900, height: 1200 },
    opening: toOpeningGeometry(wire),
    // maxTextLength intentionally absent — not in the backend model; the SDK falls back to
    // config.maxPersonalizationLength (docs/10 §5).
  };
}

export function toPage<W, T>(page: CatalogPageWire<W>, map: (wire: W) => T): Page<T> {
  return {
    data: page.data.map(map),
    hasMore: page.has_more,
    nextCursor: page.next_cursor,
  };
}

function toLabelZone(zone: { x: number; y: number; width: number; height: number }): LabelZone {
  return { x: zone.x, y: zone.y, width: zone.width, height: zone.height };
}

function toRectWithCount(rect: RectWire & { pixel_area?: number }): RectWithCount {
  return {
    pixels: {
      x: rect.pixels.x,
      y: rect.pixels.y,
      width: rect.pixels.width,
      height: rect.pixels.height,
    },
    normalized: {
      x: rect.normalized.x,
      y: rect.normalized.y,
      width: rect.normalized.width,
      height: rect.normalized.height,
    },
    ...(rect.pixel_count !== undefined
      ? { pixelCount: rect.pixel_count }
      : rect.pixel_area !== undefined
        ? { pixelCount: rect.pixel_area }
        : {}),
  };
}

function toOpeningGeometry(wire: CutoutLabelWire): OpeningGeometry {
  return {
    alphaThreshold: wire.alpha_threshold,
    fullyTransparentBounds: toRectWithCount(wire.fully_transparent_bounds),
    centerTransparentComponent: {
      ...toRectWithCount(wire.center_transparent_component),
      touchesCanvasEdge: wire.center_transparent_component.touches_canvas_edge,
    },
    largestSafeTransparentRectangle: toRectWithCount(wire.largest_safe_transparent_rectangle),
  };
}
