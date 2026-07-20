# Phase 03 · Save Path (Charter M3)

**Goal:** the real **upload-on-save** pipeline (Charter §8.4) with explicit failure UX, **reference-
only** drafts + re-open (Charter §9), `tk.orders.buildPayload()`, and the `@treatink/sdk/server`
submit helper. Still all against **fixtures** (real backend is P4) — but the full save→cart→order
shape is exercised end to end.

**In scope:** save pipeline (composite → two-asset upload `source`+`rendered` → local preview → draft
+ `onComplete`, **no sessions** — GP-07); `upload_failed`/finalize-error retry UX; `tk.drafts.*`
(localStorage references, asset ids, no image bytes); `designer.open({ draftId })` metadata re-open;
`tk.orders.buildPayload()` (real order schema, `docs/08` §7); `@treatink/sdk/server submitOrder`.
**Out of scope:** `HttpTransport`/live endpoints (P4); in-place re-edit & photo re-hydration
(deferred, `docs/10` §6); Shadow DOM.

**Entry gate:** Phase 2 exit green.
**Exit gate:** full `test:e2e` happy path (Charter §14: catalog→open→upload incl. HEIC→position→save
w/ simulated success **and** failure→retry→buildPayload→server submit) + draft re-open green;
persistence + `check:no-secret` gates green.

**Read first:** `docs/10` (types), `docs/08` §6–§7 (asset + order wire shapes), `docs/04` §2.3
(asset flow), `docs/05` §8 (export), `docs/02` §6 (privacy), Charter §8.4/§9 (intent).

---

### P3-T01 · Upload-on-save pipeline (asset model, GP-07)
- depends_on: []
- does: Implement the save sequence over the transport, **asset-based, no sessions** (`docs/04`
  §2.3, `docs/08` §6): (1) render the composite via the engine (print 900×1200 + source);
  (2) `artwork.upload({ role:'source', file })` and `artwork.upload({ role:'rendered', file })` —
  each runs declare→PUT→finalize; client computes `sha256`+`size_bytes`; (3) build the **display
  composite** locally = the print composite drawn into the variant's `catalog_image` at `label_zone`
  (`docs/05` §8.1); `previewUrl` = its object URL (GP-08 — no server read); (4) return the full
  `DesignerResult` with `artwork.sourceAssetId`/`renderedAssetId`. Fixture mode: "upload" → local
  object URLs, deterministic `ast_fx_…` ids. Cap composite dims on constrained iOS Safari.
- dod: Save runs the two-asset upload against fixtures and returns a complete `DesignerResult`
  (`cutoutLabelId`, `previewUrl`, `artwork.sourceAssetId/renderedAssetId`, `transform` incl.
  `rotation`, `labelZone`, `lowRes`) per `docs/10` §4. No `sessionId` anywhere.
- gate: `npm run test:e2e -- save-pipeline`
- refs: `docs/04` §2.3, `docs/08` §6, `docs/10` §4, `docs/05` §8, `docs/09` (GP-08)

### P3-T02 · Save failure UX (`upload_failed` + retry)
- depends_on: [P3-T01]
- does: Each of the three asset sub-steps (declare / PUT-bytes / finalize) has explicit failure
  handling surfaced in the Save UI: in-flight state, clear failure state with **retry**. Browser PUT
  failure → `upload_failed`; declare/finalize map real codes (`upload_too_large`, `upload_expired`,
  `upload_validation_failed` — `docs/02` §4). Nothing persists for a design abandoned before a
  successful save. Uploads do not blind-retry (`docs/02` §5).
- dod: injecting a failure (`tk.fixtures.failNext('assets.finalize', {status:422,
  code:'upload_validation_failed'})` and a PUT failure) shows the failure state; retry succeeds; no
  draft written on abandonment.
- gate: `npm run test:e2e -- save-failure`
- refs: `docs/04` §2.3, `docs/02` §4–§5, `docs/06` §4

### P3-T03 · Drafts store (references only)
- depends_on: [P3-T01]
- does: Implement `tk.drafts.list/get/delete/clear` over `localStorage` with the namespaced keys and
  the `DraftRecord` shape in `docs/10` §6 (asset ids, **no `sessionId`**). Written **only after a
  successful save**. **No image bytes** — references only. Bounded count (default 5, LRU), TTL
  (default 30 days), versioned namespace with migrate-or-discard, in-memory fallback if
  `localStorage` is unavailable/full.
- dod: a saved design writes a small JSON `DraftRecord` carrying `artwork.sourceAssetId/
  renderedAssetId` (no Blob/DataURL/URL); LRU eviction + TTL work; `clear()` removes references;
  persistence test proves no image bytes are stored.
- gate: `npm run test:e2e -- drafts && npm test -- drafts`
- refs: `docs/10` §6, `docs/02` §6, `docs/06` §6

### P3-T04 · Draft re-open (metadata restore)
- depends_on: [P3-T03]
- does: `tk.designer.open({ draftId })` restores **metadata** — cutout, transform, personalization
  text, label zone — via the engine restore path (`docs/05` §3). Per `docs/10` §6, the original photo
  pixels are **not** re-hydrated (no bytes stored; pk can't GET the `source` asset): the shopper
  re-selects the photo to edit. A re-save creates a **fresh** draft + assets (in-place re-edit
  deferred, Charter §2).
- dod: re-opening restores cutout + transform + text + zone; prompting for the photo on edit; re-save
  yields new `ast_…` ids + draftId. The "photo not auto-restored" limitation is asserted/documented,
  not worked around.
- gate: `npm run test:e2e -- draft-reopen`
- refs: `docs/10` §6, `docs/05` §3, Charter §2

### P3-T05 · orders.buildPayload (real order schema)
- depends_on: [P3-T01]
- does: Implement `tk.orders.buildPayload(input: BuildPayloadInput)` (`docs/10` §8) assembling the
  order body exactly (`docs/08` §7): `external_order_id`, `channel_order_number`, `currency`,
  `payment_status`, `customer`, `shipping_address`, `line_items[]` incl. `variant_id`, `sku`,
  `quantity`, `unit_price_cents`, `subtotal_cents`, `source_asset_id`, `rendered_asset_id`,
  `personalization{ personalization_text, cutout_label_id, pet_name_position, image_metadata,
  label_zone }`. No network, nothing secret. Pull `variant_id`, asset ids, cutout id + transform from
  the **draft** (`docs/10` §6). *(The `POST /v1/orders` endpoint is backend's concern — GAP-PLAN
  Out-of-scope; the SDK only produces the correct body.)*
- dod: given drafts, `buildPayload` returns a body matching `docs/08` §7 field-for-field (unit test
  against the documented example).
- gate: `npm test -- orders`
- refs: `docs/08` §7, `docs/10` §8

### P3-T06 · Server submit helper
- depends_on: [P3-T05]
- does: Implement `@treatink/sdk/server submitOrder(payload, { secretKey, channel })` (Node ≥ 18):
  `Authorization: Bearer sk_…`, channel header, `Idempotency-Key`, JSON encode, typed errors,
  documented idempotency (re-posting an `external_order_id` returns the original order). This entry
  is **never** imported by the browser build.
- dod: unit test posts to a mocked endpoint with correct headers/body; re-post is idempotent;
  `check:no-secret` still green (server code absent from browser bundle).
- gate: `npm test -- server && npm run check:no-secret`
- refs: Charter §6.4, `docs/04` §2.7, §1, `docs/06` §6

### P3-T07 · Full happy-path e2e (Charter §14)
- depends_on: [P3-T02, P3-T03, P3-T04, P3-T05, P3-T06]
- does: Single Playwright flow (fixtures mode): catalog → `designer.open` → upload (incl. one HEIC)
  → position/zoom → add text → save (simulated success **and** a failure→retry) → `buildPayload` →
  `submitOrder` → plus draft re-open. This is the Definition-of-Done demo.
- dod: the whole flow passes in fixtures mode; matches Charter §14's integration test.
- gate: `npm run test:e2e -- happy-path`
- refs: Charter §14, `docs/06` §4

---

### P3-T08 · Integration quickstart & API reference docs (operationalizes the §14 DoD)
- depends_on: [P3-T07]
- does: Author the public integration docs a cold developer uses: a **quickstart** (script tag /
  npm install → `Treatink.init` → `designer.open` → add-to-cart with `onComplete` → `buildPayload` →
  server `submitOrder`), the theming/copy guide, the recommended CSP/SRI snippet (`docs/11` §5), and
  a generated API reference from the public types (`docs/10`). The quickstart's code sample is the
  **same** flow the P3-T07 e2e exercises — keep them in lockstep.
- dod: a `README`/`docs/` quickstart exists; its fixtures-mode code sample is copy-runnable and is
  executed by an e2e smoke (`quickstart.spec`) that passes — the machine proxy for "a cold dev
  integrates in fixtures in < 1 day from the docs" (Charter §14).
- gate: `npm run test:e2e -- quickstart`
- refs: Charter §14, §5, `docs/10`, `docs/11` §5

## Phase 3 exit checklist
- [ ] `npm run test:e2e -- happy-path` green (success + failure→retry + draft re-open)
- [ ] Drafts store references only — persistence gate proves no image bytes
- [ ] `buildPayload` matches the live order schema field-for-field
- [ ] `submitOrder` idempotent; `check:no-secret` green (server code out of browser bundle)
- [ ] `npm run verify` + size budgets green
