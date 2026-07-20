# server/ → `@treatink/sdk/server`

The one secret-key operation: order submission (Charter §6.4). Node ≥ 18, ESM. Built as a **separate
entry** and **never** imported by the browser build (`scripts/check-no-secret.mjs` enforces this).

`submitOrder(payload, { secretKey, channel, idempotencyKey })` — `Authorization: Bearer sk_…`,
`Idempotency-Key`, JSON; maps the error envelope to `TreatinkError`; idempotent on `external_order_id`.
Targets the docs/08 §7 body. The real `POST /v1/orders` endpoint is the backend's to build
(GAP-PLAN out-of-scope); this helper is testable against a mock. Implemented by P3-T06.
