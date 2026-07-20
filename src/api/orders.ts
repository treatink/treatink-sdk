import { TreatinkError } from '../types.js';
import type { BuildPayloadInput, DraftRecord, OrderPayload, OrdersApi } from '../types.js';

/**
 * tk.orders.buildPayload (P3-T05, docs/10 §8): assembles the EXACT docs/08 §7 order body —
 * snake_case wire fields, personalization block with image_metadata in 900×1200 canvas space
 * (docs/05 §8.2). Pure: no network, nothing secret. variant_id, asset ids, cutout id, transform,
 * and zone are pulled from the referenced DRAFT (docs/10 §6). The POST /v1/orders endpoint is the
 * backend's concern (GAP-PLAN out-of-scope); the SDK only produces the correct body.
 */
export function createOrdersApi(getDraft: (draftId: string) => DraftRecord | null): OrdersApi {
  return {
    buildPayload(input: BuildPayloadInput): OrderPayload {
      return {
        external_order_id: input.externalOrderId,
        ...(input.channelOrderNumber !== undefined
          ? { channel_order_number: input.channelOrderNumber }
          : {}),
        currency: input.currency,
        payment_status: input.paymentStatus,
        customer: {
          email: input.customer.email,
          ...(input.customer.firstName !== undefined
            ? { first_name: input.customer.firstName }
            : {}),
          ...(input.customer.lastName !== undefined ? { last_name: input.customer.lastName } : {}),
        },
        ...(input.shippingAddress
          ? {
              shipping_address: {
                name: input.shippingAddress.name,
                address1: input.shippingAddress.address1,
                address2: input.shippingAddress.address2 ?? null,
                city: input.shippingAddress.city,
                state: input.shippingAddress.state,
                postal_code: input.shippingAddress.postalCode,
                country_code: input.shippingAddress.countryCode,
              },
            }
          : {}),
        line_items: input.lines.map((line) => {
          const draft = getDraft(line.draftId);
          if (!draft) {
            throw new TreatinkError(
              'not_found',
              `buildPayload: draft '${line.draftId}' does not exist.`,
              { param: 'draftId' },
            );
          }
          return {
            ...(line.externalLineItemId !== undefined
              ? { external_line_item_id: line.externalLineItemId }
              : {}),
            ...(draft.product.variantId !== undefined
              ? { variant_id: draft.product.variantId }
              : {}),
            sku: draft.product.sku,
            quantity: line.quantity,
            unit_price_cents: line.unitPriceCents,
            subtotal_cents: line.subtotalCents ?? line.quantity * line.unitPriceCents,
            source_asset_id: draft.artwork.sourceAssetId,
            rendered_asset_id: draft.artwork.renderedAssetId,
            personalization: {
              personalization_text: draft.personalizationText ?? null,
              cutout_label_id: draft.cutout.cutoutLabelId,
              ...(draft.cutout.petNamePosition !== undefined
                ? { pet_name_position: draft.cutout.petNamePosition }
                : {}),
              // 900×1200 print-canvas space, self-contained for print re-render (docs/05 §8.2)
              image_metadata: {
                x: draft.transform.x,
                y: draft.transform.y,
                scale: draft.transform.scale,
                rotation: draft.transform.rotation,
              },
              label_zone: {
                x: draft.labelZone.x,
                y: draft.labelZone.y,
                width: draft.labelZone.width,
                height: draft.labelZone.height,
              },
            },
          };
        }),
      };
    },
  };
}
