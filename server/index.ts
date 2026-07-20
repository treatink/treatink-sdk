import type { OrderPayload } from '../src/types.js';

/**
 * @treatink/sdk/server — the ONLY secret-key operation: order submission (Charter §6.4). Node ≥ 18.
 * NEVER imported by the browser build (enforced by scripts/check-no-secret.mjs).
 *
 * NOTE: the real POST /v1/orders endpoint does not exist yet (GAP-PLAN out-of-scope, backend's job).
 * This helper targets the docs/08 §7 body and is testable against a mock. Implemented by: P3-T06.
 */
export interface SubmitOrderOptions {
  /** Secret key: sk_test_… | sk_live_… */
  secretKey: string;
  channel: string;
  apiBaseUrl?: string;
  /** Stable key; re-posting the same external_order_id returns the original order (idempotent). */
  idempotencyKey?: string;
}

export interface SubmitOrderResult {
  id: string;
  orderNumber: string;
  status: string;
  externalOrderId: string;
}

export async function submitOrder(
  _payload: OrderPayload,
  _options: SubmitOrderOptions,
): Promise<SubmitOrderResult> {
  // P3-T06: POST payload with Authorization: Bearer sk_…, channel, Idempotency-Key, JSON;
  // map the error envelope to TreatinkError; idempotent retry safe.
  throw new Error('NOT_IMPLEMENTED: submitOrder (P3-T06)');
}
