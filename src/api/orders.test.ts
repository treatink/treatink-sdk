import { describe, expect, it } from 'vitest';
import { createOrdersApi } from './orders.js';
import { TreatinkError } from '../types.js';
import type { BuildPayloadInput, DraftRecord } from '../types.js';

// P3-T05 → live contract 2026-07-22: buildPayload matches the REAL POST /v1/orders body
// (treatink-api orders/schemas.py; docs/08 §7) FIELD-FOR-FIELD, explicit nulls included.

const DRAFT: DraftRecord = {
  draftId: 'draft-1',
  createdAt: '2026-07-20T12:00:00.000Z',
  updatedAt: '2026-07-20T12:00:00.000Z',
  channel: 'rileyspets.com',
  product: { sku: 'SSGTTBC', variantId: 'var_0000000000000000000000000000ef01' },
  cutout: { cutoutLabelId: 'cut_0000000000000000000000000000aa01', petNamePosition: 'bottom' },
  personalizationText: 'Milo',
  transform: { x: 250, y: 300, scale: 1.4, rotation: 0 },
  labelZone: { x: 0.321, y: 0.316, width: 0.358, height: 0.478 },
  artwork: {
    sourceAssetId: 'ast_0000000000000000000000000000b101',
    renderedAssetId: 'ast_0000000000000000000000000000b102',
  },
  status: 'completed',
};

const orders = createOrdersApi((id) => (id === 'draft-1' ? DRAFT : null));

const BASE: BuildPayloadInput = {
  externalOrderId: 'partner-1001',
  displayOrderNumber: '#1001',
  currency: 'USD',
  recipient: { name: 'A B', email: 'a@b.com', phone: null },
  destination: {
    addressLine1: '1 St',
    city: 'X',
    region: 'CA',
    postalCode: '90000',
    countryCode: 'US',
  },
  amounts: {
    subtotalCents: 999,
    discountCents: 0,
    shippingCents: 295,
    taxCents: 0,
    totalCents: 1294,
  },
  lines: [
    {
      externalLineItemId: 'li-1',
      draftId: 'draft-1',
      quantity: 1,
      unitPriceCents: 999,
      subtotalCents: 999,
    },
  ],
};

describe('buildPayload (real POST /v1/orders contract, docs/08 §7)', () => {
  it('assembles the wire body field-for-field with explicit nulls (strict schema)', () => {
    const payload = orders.buildPayload(BASE);
    expect(payload).toEqual({
      external_order_id: 'partner-1001',
      display_order_number: '#1001',
      currency: 'USD',
      recipient: { name: 'A B', email: 'a@b.com', phone: null },
      destination: {
        address_line_1: '1 St',
        address_line_2: null,
        city: 'X',
        region: 'CA',
        postal_code: '90000',
        country_code: 'US',
      },
      fulfillment: { delivery_method: 'ship_to_recipient', instructions: null },
      amounts: {
        subtotal_cents: 999,
        discount_cents: 0,
        shipping_cents: 295,
        tax_cents: 0,
        total_cents: 1294,
      },
      line_items: [
        {
          external_line_item_id: 'li-1',
          variant_id: 'var_0000000000000000000000000000ef01',
          quantity: 1,
          unit_price_cents: 999,
          subtotal_cents: 999,
          personalization: {
            source_asset_id: 'ast_0000000000000000000000000000b101',
            rendered_asset_id: 'ast_0000000000000000000000000000b102',
            cutout_label_id: 'cut_0000000000000000000000000000aa01',
            pet_name: 'Milo',
          },
        },
      ],
    });
    // The wire carries NO transform/zone/position/sku — those stay in the draft (docs/05 §8.2).
    const wire = JSON.stringify(payload);
    for (const gone of ['image_metadata', 'label_zone', 'pet_name_position', 'sku', 'session']) {
      expect(wire.toLowerCase()).not.toContain(gone);
    }
  });

  it('computes subtotal_cents when absent; defaults display/fulfillment to nulls', () => {
    const { displayOrderNumber: _omitted, ...withoutDisplay } = BASE;
    const payload = orders.buildPayload({
      ...withoutDisplay,
      lines: [{ externalLineItemId: 'li-1', draftId: 'draft-1', quantity: 3, unitPriceCents: 500 }],
    }) as Record<string, unknown>;
    const line = (payload['line_items'] as Record<string, unknown>[])[0]!;
    expect(line['subtotal_cents']).toBe(1500);
    expect(payload['display_order_number']).toBeNull();
    expect(payload['fulfillment']).toEqual({
      delivery_method: 'ship_to_recipient',
      instructions: null,
    });
  });

  it('mirrors the wire validators: contact required, unique line ids, resolved variant', () => {
    expect(() =>
      orders.buildPayload({ ...BASE, recipient: { name: 'A B', email: null, phone: null } }),
    ).toThrowError(/email or phone/);
    expect(() =>
      orders.buildPayload({
        ...BASE,
        lines: [
          { externalLineItemId: 'dup', draftId: 'draft-1', quantity: 1, unitPriceCents: 1 },
          { externalLineItemId: 'dup', draftId: 'draft-1', quantity: 1, unitPriceCents: 1 },
        ],
      }),
    ).toThrowError(/not unique/);
    expect(() =>
      orders.buildPayload({
        ...BASE,
        lines: [{ externalLineItemId: 'li-x', draftId: 'nope', quantity: 1, unitPriceCents: 1 }],
      }),
    ).toThrowError(TreatinkError);
  });
});
