import { describe, expect, it } from 'vitest';
import { createOrdersApi } from './orders.js';
import { TreatinkError } from '../types.js';
import type { DraftRecord } from '../types.js';

// P3-T05: buildPayload matches the docs/08 §7 documented example FIELD-FOR-FIELD.

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

describe('buildPayload (docs/08 §7)', () => {
  it('assembles the documented example body field-for-field', () => {
    const payload = orders.buildPayload({
      externalOrderId: 'partner-1001',
      channelOrderNumber: '1001',
      currency: 'USD',
      paymentStatus: 'paid',
      customer: { email: 'a@b.com', firstName: 'A', lastName: 'B' },
      shippingAddress: {
        name: 'A B',
        address1: '1 St',
        address2: null,
        city: 'X',
        state: 'CA',
        postalCode: '90000',
        countryCode: 'US',
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
    });

    expect(payload).toEqual({
      external_order_id: 'partner-1001',
      channel_order_number: '1001',
      currency: 'USD',
      payment_status: 'paid',
      customer: { email: 'a@b.com', first_name: 'A', last_name: 'B' },
      shipping_address: {
        name: 'A B',
        address1: '1 St',
        address2: null,
        city: 'X',
        state: 'CA',
        postal_code: '90000',
        country_code: 'US',
      },
      line_items: [
        {
          external_line_item_id: 'li-1',
          variant_id: 'var_0000000000000000000000000000ef01',
          sku: 'SSGTTBC',
          quantity: 1,
          unit_price_cents: 999,
          subtotal_cents: 999,
          source_asset_id: 'ast_0000000000000000000000000000b101',
          rendered_asset_id: 'ast_0000000000000000000000000000b102',
          personalization: {
            personalization_text: 'Milo',
            cutout_label_id: 'cut_0000000000000000000000000000aa01',
            pet_name_position: 'bottom',
            image_metadata: { x: 250, y: 300, scale: 1.4, rotation: 0 },
            label_zone: { x: 0.321, y: 0.316, width: 0.358, height: 0.478 },
          },
        },
      ],
    });
  });

  it('computes subtotal_cents when absent and omits optional fields cleanly', () => {
    const payload = orders.buildPayload({
      externalOrderId: 'p-2',
      currency: 'USD',
      paymentStatus: 'paid',
      customer: { email: 'a@b.com' },
      lines: [{ draftId: 'draft-1', quantity: 3, unitPriceCents: 500 }],
    }) as Record<string, unknown>;
    const line = (payload['line_items'] as Record<string, unknown>[])[0]!;
    expect(line['subtotal_cents']).toBe(1500);
    expect(payload).not.toHaveProperty('channel_order_number');
    expect(payload).not.toHaveProperty('shipping_address');
    expect(line).not.toHaveProperty('external_line_item_id');
    expect(payload['customer'] as object).toEqual({ email: 'a@b.com' });
  });

  it('unknown draftId → not_found; nothing session-shaped anywhere', () => {
    expect(() =>
      orders.buildPayload({
        externalOrderId: 'p-3',
        currency: 'USD',
        paymentStatus: 'paid',
        customer: { email: 'a@b.com' },
        lines: [{ draftId: 'nope', quantity: 1, unitPriceCents: 1 }],
      }),
    ).toThrowError(TreatinkError);

    const payload = orders.buildPayload({
      externalOrderId: 'p-4',
      currency: 'USD',
      paymentStatus: 'paid',
      customer: { email: 'a@b.com' },
      lines: [{ draftId: 'draft-1', quantity: 1, unitPriceCents: 1 }],
    });
    expect(JSON.stringify(payload).toLowerCase()).not.toContain('session');
  });
});
