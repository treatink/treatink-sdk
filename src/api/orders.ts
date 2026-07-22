import { TreatinkError } from '../types.js';
import type { BuildPayloadInput, DraftRecord, OrderPayload, OrdersApi } from '../types.js';

/**
 * tk.orders.buildPayload (P3-T05 → live contract 2026-07-22): assembles the EXACT
 * POST /v1/orders body the real backend validates (treatink-api orders/schemas.py — strict,
 * `extra="forbid"`; docs/08 §7). Nullable wire fields are emitted as EXPLICIT nulls (pydantic
 * strict mode requires their presence). Pure: no network, nothing secret.
 *
 * Per-line personalization on the wire is asset-referential only: source/rendered asset ids,
 * nullable cutout_label_id, nullable pet_name. The print pipeline uses the RENDERED asset
 * directly — the transform / pet-name position / label zone stay client-side in the draft
 * (docs/05 §8.2 note) and are NOT part of the order body.
 */
export function createOrdersApi(getDraft: (draftId: string) => DraftRecord | null): OrdersApi {
  return {
    buildPayload(input: BuildPayloadInput): OrderPayload {
      // Client-side mirrors of the wire's model validators — fail fast with clear messages.
      if ((input.recipient.email ?? null) === null && (input.recipient.phone ?? null) === null) {
        throw new TreatinkError(
          'bad_request',
          'buildPayload: recipient needs at least one of email or phone.',
          { param: 'recipient' },
        );
      }
      const seenLineIds = new Set<string>();
      for (const line of input.lines) {
        if (seenLineIds.has(line.externalLineItemId)) {
          throw new TreatinkError(
            'bad_request',
            `buildPayload: externalLineItemId '${line.externalLineItemId}' is not unique.`,
            { param: 'externalLineItemId' },
          );
        }
        seenLineIds.add(line.externalLineItemId);
      }

      return {
        external_order_id: input.externalOrderId,
        display_order_number: input.displayOrderNumber ?? null,
        currency: input.currency,
        recipient: {
          name: input.recipient.name,
          email: input.recipient.email ?? null,
          phone: input.recipient.phone ?? null,
        },
        destination: {
          address_line_1: input.destination.addressLine1,
          address_line_2: input.destination.addressLine2 ?? null,
          city: input.destination.city,
          region: input.destination.region ?? null,
          postal_code: input.destination.postalCode ?? null,
          country_code: input.destination.countryCode,
        },
        fulfillment: {
          delivery_method: 'ship_to_recipient', // the only wire value
          instructions: input.fulfillment?.instructions ?? null,
        },
        amounts: {
          subtotal_cents: input.amounts.subtotalCents,
          discount_cents: input.amounts.discountCents,
          shipping_cents: input.amounts.shippingCents,
          tax_cents: input.amounts.taxCents,
          total_cents: input.amounts.totalCents,
        },
        line_items: input.lines.map((line) => {
          const draft = getDraft(line.draftId);
          if (!draft) {
            throw new TreatinkError(
              'not_found',
              `buildPayload: draft '${line.draftId}' does not exist.`,
              { param: 'draftId' },
            );
          }
          if (draft.product.variantId === undefined) {
            // The wire requires variant_id; a draft saved without variant resolution can't ship.
            throw new TreatinkError(
              'bad_request',
              `buildPayload: draft '${line.draftId}' has no resolved variantId.`,
              { param: 'variantId' },
            );
          }
          return {
            external_line_item_id: line.externalLineItemId,
            variant_id: draft.product.variantId,
            quantity: line.quantity,
            unit_price_cents: line.unitPriceCents,
            subtotal_cents: line.subtotalCents ?? line.quantity * line.unitPriceCents,
            personalization: {
              source_asset_id: draft.artwork.sourceAssetId,
              rendered_asset_id: draft.artwork.renderedAssetId,
              cutout_label_id: draft.cutout.cutoutLabelId ?? null,
              pet_name: draft.personalizationText ?? null,
            },
          };
        }),
      };
    },
  };
}
