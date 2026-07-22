import { fromEnvelope, type ApiErrorEnvelope } from '../src/transport/errors.js';
import { TreatinkError } from '../src/types.js';
import type { OrderPayload } from '../src/types.js';

/**
 * @treatink/sdk/server — the ONLY secret-key operation: order submission (Charter §6.4). Node ≥ 18.
 * NEVER imported by the browser build (enforced by scripts/check-no-secret.mjs).
 *
 * POST /v1/orders is LIVE (treatink-api orders/composition.py, 2026-07-22): secret-key scope
 * (order_manage), REQUIRED Idempotency-Key header (1–255 visible-ASCII; scoped per partner+mode;
 * same key + different body → 409 idempotency_conflict), and a separate per-scope uniqueness
 * constraint on external_order_id. Tenant/channel derives from the bearer key — NO channel header
 * on the wire (docs/04 §2.8); `channel` is kept in options for symmetry/validation only.
 * Default Idempotency-Key = the payload's external_order_id, so re-posting the same order body
 * replays the original response — safe to retry.
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
  /** 'received' on creation (wire vocabulary: received | in_production | shipped | rejected | cancelled). */
  status: string;
  externalOrderId: string;
  displayOrderNumber: string | null;
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
  const response = await fetch(`${options.apiBaseUrl ?? 'https://treatinkapi.com'}/v1/orders`, {
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
    status: string;
    external_order_id: string;
    display_order_number: string | null;
  };
  return {
    id: order.id,
    status: order.status,
    externalOrderId: order.external_order_id,
    displayOrderNumber: order.display_order_number ?? null,
  };
}
