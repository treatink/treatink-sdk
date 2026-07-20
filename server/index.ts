import { fromEnvelope, type ApiErrorEnvelope } from '../src/transport/errors.js';
import { TreatinkError } from '../src/types.js';
import type { OrderPayload } from '../src/types.js';

/**
 * @treatink/sdk/server — the ONLY secret-key operation: order submission (Charter §6.4). Node ≥ 18.
 * NEVER imported by the browser build (enforced by scripts/check-no-secret.mjs).
 *
 * NOTE: the real POST /v1/orders endpoint does not exist yet (GAP-PLAN out-of-scope, backend's
 * job). This helper targets the docs/08 §7 body and is testable against a mock. Tenant/channel
 * derives from the bearer key — NO channel header on the wire (docs/04 §2.8); `channel` is kept
 * in options for symmetry/validation only. Idempotent: re-posting the same `external_order_id`
 * (the default Idempotency-Key) returns the original order — safe to retry.
 */
export interface SubmitOrderOptions {
  /** Secret key: sk_test_… | sk_live_… */
  secretKey: string;
  channel: string;
  apiBaseUrl?: string;
  /** Stable key; defaults to the payload's external_order_id. */
  idempotencyKey?: string;
}

export interface SubmitOrderResult {
  id: string;
  orderNumber: string;
  status: string;
  externalOrderId: string;
}

export async function submitOrder(
  payload: OrderPayload,
  options: SubmitOrderOptions,
): Promise<SubmitOrderResult> {
  if (!options.secretKey.startsWith('sk_')) {
    throw new TreatinkError(
      'key_scope_violation',
      'submitOrder requires a SECRET key (sk_test_… or sk_live_…) — never a publishable key.',
    );
  }
  const rawExternalOrderId = (payload as Record<string, unknown>)['external_order_id'];
  const externalOrderId = typeof rawExternalOrderId === 'string' ? rawExternalOrderId : '';
  const response = await fetch(`${options.apiBaseUrl ?? 'https://api.treatink.com'}/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.secretKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': options.idempotencyKey ?? externalOrderId,
    },
    body: JSON.stringify(payload),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (body && typeof body === 'object' && 'error' in body) {
      throw fromEnvelope(response.status, body as ApiErrorEnvelope);
    }
    throw new TreatinkError('bad_request', `order submit failed (HTTP ${response.status})`, {
      status: response.status,
    });
  }

  const order = body as {
    id: string;
    order_number: string;
    status: string;
    external_order_id: string;
  };
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    externalOrderId: order.external_order_id,
  };
}
