# Gap-Filling Plan — SDK build readiness only

**Scope.** Only gaps that block building a **correct, complete SDK**. Backend and infra are **not our
concern** — the backend developer owns them, and the SDK builds against **fixtures** regardless (see
"Out of scope" at the bottom). A gap counts here only if it stops the SDK from being built or makes
it build the *wrong* thing.

**Owner tags.** `[SDK]` our blueprint/code · `[INPUT]` an asset only you can provide. Check the box
when done.

**Adopted decisions (minimal footprint, no backend):** drop the public `sessions` namespace (SDK is
asset-based); don't rely on `channel_not_registered` (wildcard CORS); produce the preview locally in
the browser. Recorded in `docs/09-decisions.md`. Veto any if you disagree.

---

## Part 1 — Real SDK gaps (must fix to build correctly)

Why these are SDK gaps and not backend: the SDK's fixtures must **match the real wire format exactly**
(Charter §1) so going live is a config change, not a rewrite. Getting the shapes, types, data, and
tests right is entirely in our hands.

- [x] **GP-03 `[SDK]` Contract → asset model.** Fixtures/types must mirror the real backend
  (asset-based, no sessions), or the SDK would be built against a fiction. → `docs/04` §2.2–2.3.
  **DONE.**
- [x] **GP-04 `[SDK]` Two-step upload in `Transport` + fixtures.** Real upload is declare→PUT→finalize;
  the transport + `FixtureTransport` model exactly that. → `docs/04` §2.3. **DONE (spec);** built in
  Phase 1 T06.
- [x] **GP-06 `[SDK]` Error codes → real envelope.** `TreatinkError` codes/status map pinned to the
  real API so error handling and tests are truthful. → `docs/02` §4. **DONE.**
- [x] **GP-08 `[SDK]` Local preview.** `DesignerResult.previewUrl` = in-browser composite object URL;
  removes any dependency on a backend preview endpoint. → `docs/04` §2.3, `docs/09`. **DONE.**
- [x] **GP-11 `[SDK]` Pin toolchain.** Bundler/test/canvas/HEIC/versions pinned so the loop never
  stalls on a fork. → `docs/09-decisions.md`. **DONE.**
- [x] **GP-05 `[SDK]` `DraftRecord` → asset ids.** *Fix:* `DraftRecord` in `docs/10` §6 stores
  `sourceAssetId`/`renderedAssetId`/`cutoutLabelId` + transform, no `sessionId`, no bytes; re-open
  limitation documented. Phase-3 T03/T04 updated. **DONE.**
- [x] **GP-07 `[SDK]` Rewrite Phase-3 save pipeline to the asset model.** *Fix:* Phase-3 T01/T02/T03/
  T04/T05 + intro rewritten to two-asset upload (declare→PUT→finalize) + local preview + draft +
  `buildPayload` targeting `docs/08` §7. Session refs also purged from Phase-1 T06/T08 + `docs/01`
  map. **DONE.**
- [x] **GP-09 `[SDK]` Fixtures-contract doc (exact JSON).** *Fix:* `docs/08-fixtures-contract.md`
  with real example payloads (channel, products, variants, bundles, cutout-labels, two-step asset
  flow, order body, error envelope) copied from the `treatink-api` schemas. **DONE.**
- [x] **GP-10 `[SDK]` Vendor seed data (spec).** *Fix:* exact extraction sources + procedure pinned
  in `docs/08` §9 (frames from `../treatink/web/public/frames`, metadata from `customizerSlice.jsx`,
  products from the api seed, sample photos). The binary copy runs in Phase-1 T07/T10. **DONE (spec);
  extraction is a build task.**
- [x] **GP-12 `[SDK]` Freeze the full `types.ts`.** *Fix:* `docs/10-public-types.md` — full frozen
  surface (config, instance, namespaces, designer options/result, catalog models, DraftRecord,
  errors, theme, full `CopyStrings`, `BuildPayloadInput`) + a Charter-§6 delta table. **DONE.**
- [x] **GP-13 `[SDK]` Golden-baseline procedure + tolerance.** *Fix:* `docs/06` §3 rewritten —
  baselines from **two trusted sources** (hand-computed anchors + composites rendered by the store's
  own `canvasRenderer.js`/`renderPetName.js` headless), tolerance pinned (≤0.1% pixels >2/255; floats
  ≤1e-6). Resolves the self-referential concern. **DONE.**
- [x] **GP-14 `[SDK]` Security checklist.** *Fix:* `docs/11-security.md` — key discipline, photo
  privacy, host-page XSS/light-DOM, transport/uploads, distribution (SRI/CSP), per-phase gate table.
  **DONE.**
- [x] **GP-15 `[SDK]` Release/publish spec.** *Fix:* `phases/04` P4-T08 — CDN+SRI publish to
  `sdk.treatink.com/v1`, npm publish, budgets/no-secret gates before publish. **DONE.**

---

## Part 2 — Inputs (RESOLVED from the workspace — no external assets needed)

Owner decision: default styling = the current treatink.com customizer, which is in the workspace. And
the "Riley's designer" is that same customizer embedded via iframe (API mode) — so the store code is
the full visual + behavioral reference. No external capture required.

- [x] **GP-16 `[INPUT→SDK]` Design/parity reference.** *Resolved:* `docs/design-reference.md` — the
  iframe→SDK migration mapping + Phase-2 parity target, all sourced from the store customizer.
- [x] **GP-17 `[INPUT→SDK]` Default theme + fonts.** *Resolved:* theme defaults extracted from the
  store (Charter §7.3 palette) in `docs/design-reference.md` §3. **Open sub-task (Phase 2):** bundle a
  **Mitr** font subset (no third-party requests) for on-label text + Node golden tests — §4. Logo is
  optional (`theme.logo`).

---

## Part 3 — Owner decisions (adopted; veto window open)

- [x] **GP-18** Drop `tk.sessions.*` (asset-based). → `docs/09`.
- [x] **GP-19** Keep wildcard CORS; SDK doesn't use `channel_not_registered`. → `docs/09`.
- [x] **GP-20** Local preview for MVP. → `docs/09`.

---

## Out of scope — NOT our concern (backend developer owns; fixtures cover them)

These do **not** block the SDK build. The SDK ships against fixtures; wiring to the live backend is a
later config change the backend dev enables by delivering these. Listed only for traceability.

- **Real `POST /v1/orders` endpoint** — fixtures simulate it; our `orders.buildPayload` just targets
  its documented schema. (was GP-01)
- **Storage-bucket CORS for browser PUT** to presigned URLs — live-mode infra. (was GP-02)
- **pk-readable preview endpoint** — sidestepped entirely by GP-08 (local preview).
- **Channel-scoped CORS / `channel_not_registered`** — skipped by GP-19.
- **Public api-docs alignment** — backend/docs-team task (Charter §17).

If the backend dev wants the precise shapes we need them to honor (order body, asset flow, catalog),
those are documented in `docs/04-api-reconciliation.md` and `docs/08-fixtures-contract.md` (GP-09) —
hand them over as a reference, but their delivery is not on our critical path.

---

## Execution order (SDK only)

1. **GP-09** fixtures-contract (unblocks fixtures + types) → **GP-12** freeze types → **GP-05/07**
   asset-model drafts + save pipeline.
2. **GP-10** seed data → **GP-13** golden procedure.
3. **GP-14** security → **GP-15** release spec.
4. **GP-16/17** inputs requested from you (parallel; Phase-2 fidelity).

Progress mirrored in the Iteration Log of `STATE.md`.
