# Phase 01 · Core (Charter M1)

**Goal:** a buildable package skeleton with `Treatink.init` + key guard, the `Transport` seam with a
complete `FixtureTransport`, and the **pure cutout engine ported from the store code** with golden
tests passing.

**In scope:** tooling/CI, public type surface, config + key guard, error model, transport interface
+ fixtures, catalog adapter, the DOM-free engine (geometry, transform, render, text, export),
golden-test harness.
**Out of scope:** any UI/modal (P2), upload/network to real backend (P4), drafts persistence (P3).

**Entry gate:** blueprint present (this repo).
**Exit gate:** `npm run verify` + `npm run test:golden` + `npm run check:no-secret` all green.

**Read first:** `docs/01-architecture.md`, `docs/02-conventions.md`, `docs/05-engine-reference.md`,
`docs/06-testing-and-gates.md`, `docs/04-api-reconciliation.md` (§2.1 keys, §2.4 catalog).

---

### P1-T01 · Toolchain & repo scaffold — SKELETON PROVIDED, verify + install
- depends_on: []
- does: **The scaffold already exists** (pinned `package.json`, `tsconfig.json`, `tsup.config.ts`,
  `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`, `playwright.config.ts`,
  `scripts/check-no-secret.mjs`, and the `src/` tree per `docs/01` §3 with per-module READMEs + typed
  stubs). This task: `npm install`, then make the provided scaffold pass the gates — fix any pinned
  version/config issue that surfaces (I could not run npm when authoring it). Commit the lockfile.
- dod: `npm install` clean; `npm run typecheck`, `npm run lint`, `npm run build` exit 0; lockfile
  committed. Stubs still `throw NOT_IMPLEMENTED` — that's expected.
- gate: `npm run typecheck && npm run lint && npm run build`
- refs: `docs/01` §2–§3, `docs/02` §1, `docs/09` (pinned toolchain)

### P1-T02 · Gate scripts & CI
- depends_on: [P1-T01]
- does: Add npm scripts `verify`, `size`, `test:golden`, `test:e2e`, `test:a11y`,
  `check:no-secret` (stubs that will grow), and the bundle-size tool wired to the budgets in
  `docs/06` §2. Add CI running `verify` on push. `check:no-secret` scans the built browser bundle
  for any `sk_`/secret bearer path or `/server` import.
- dod: every script in `docs/06` §1 exists and runs (may be trivially green where no code yet);
  `npm run size` reports sizes and enforces budgets; CI config committed.
- gate: `npm run verify && npm run size && npm run check:no-secret`
- refs: `docs/06` §1, §2, §6

### P1-T03 · Public types (the contract) — PROVIDED, verify
- depends_on: [P1-T01]
- does: **`src/types.ts` already holds the full frozen surface** (transcribed from `docs/10`) and
  `src/index.ts` re-exports the public types. Verify it matches `docs/10` exactly and that `index.ts`
  exports nothing internal. Adjust only if `docs/10` and the file diverge.
- dod: types compile; public exports == `docs/10`; no internal symbol leaks from `index.ts`.
- gate: `npm run typecheck`
- refs: `docs/10`, `docs/02` §2

### P1-T04 · Config + key-prefix guard
- depends_on: [P1-T03]
- does: Implement `Treatink.init(config)` and the key guard. Accept **only** publishable prefixes
  (`pk_test_`, `pk_live_`); reject `sk_*`, `tk_live_*`, or any non-`pk_` with `TreatinkError
  { code:'key_scope_violation' }` thrown synchronously. Keep accepted prefixes in one constant
  (`docs/04` §2.1). Validate `channel` present. Default `mode:'fixtures'` for now.
- dod: valid `pk_` key returns a `tk` instance; every invalid key throws `key_scope_violation`.
- gate: `npm test -- config` (unit test covers accept/reject matrix incl. `sk_`, `tk_live_`, empty)
- refs: Charter §6.1, §10.1, `docs/04` §2.1, `docs/06` §6

### P1-T05 · Error model
- depends_on: [P1-T03]
- does: Implement `TreatinkError` + a central code map in `transport/errors.ts` (documented API
  codes + SDK-local codes per Charter §6.5 / `docs/02` §4). Provide a mapper from the API error
  envelope `{ error:{ type,code,message,param,request_id } }` (`docs/04` §1) to `TreatinkError`.
- dod: mapper produces identical `TreatinkError` shapes from both a live-style envelope and a
  fixture-triggered error.
- gate: `npm test -- errors`
- refs: Charter §6.5, `docs/04` §1, `docs/02` §4

### P1-T06 · Transport interface + FixtureTransport
- depends_on: [P1-T05]
- does: Define `Transport` (the only backend seam). Implement `FixtureTransport` reproducing the
  wire contracts in `docs/08` exactly: channel, catalog (products/variants/bundles/cutout-labels),
  the **two-step asset flow** (declare `ast_fx_…` → simulated presign → finalize; "PUT" is a no-op,
  upload becomes a local object URL), order echo, full error envelope. Add
  `tk.fixtures.failNext(op, { status, code })` and configurable latency (Charter §11). **No
  sessions** (GP-18).
- dod: fixture calls return `docs/08`-shaped objects; `failNext` yields the exact `TreatinkError`;
  uploads never hit the network.
- gate: `npm test -- transport`
- refs: Charter §11, `docs/01` §4, `docs/04` §2

### P1-T07 · Catalog fixtures + adapter
- depends_on: [P1-T06]
- does: Ship `fixtures/` catalog implementing Appendix B (provisional) behind `catalog/adapter.ts`:
  14 products, ~95 cutouts, incl. edge cases (no-zone products, slug collisions, storefront-only
  Riley's product, ≥1 `vertical:"merch"`). Seed from the store's frames/metadata
  (`../treatink/.../customizerSlice.jsx` frame list + `public/frames`). Adapter resolves a `sku` to
  `{ family, variant }` per the live catalog/variant split (`docs/04` §2.4) and exposes Charter-
  shaped `products.list/get`, `templates.list({sku})`.
- dod: `products.get(sku)` and `templates.list({sku})` return normalized internal models; edge-case
  fixtures load without error.
- gate: `npm test -- catalog`
- refs: Charter §11, Appendix B, `docs/04` §2.4/§2.5, `docs/01` §5

### P1-T08 · API namespaces (publishable, fixtures-backed)
- depends_on: [P1-T06, P1-T07]
- does: Implement `tk.products.*`, `tk.templates.list`, `tk.artwork.upload` (the two-step asset
  flow), `tk.orders.buildPayload` per the frozen types (`docs/10`) as thin typed wrappers over the
  transport (no direct `fetch`). Client-side file validation before declare (type, ≤ 25 MB →
  `unsupported_file_type`/`upload_too_large`). **No `sessions` namespace** (GP-18).
- dod: each namespace method works end to end against `FixtureTransport`; invalid file →
  `unsupported_file_type`; oversize rejected before "network"; surface matches `docs/10`.
- gate: `npm test -- api`
- refs: `docs/10`, `docs/04` §2.3, `docs/08` §6, `docs/02` §4–§5

### P1-T12 · Event bus (`tk.on`)
- depends_on: [P1-T03]
- does: Implement `tk.on(event, handler): () => void` with a small typed emitter for
  `'designer:open' | 'designer:close' | 'draft:saved' | 'error'` (`docs/10` §2). Provide an internal
  `emit(event, payload)` the designer (P2) and save/drafts (P3) call. Unsubscribe via the returned
  function.
- dod: subscribing then triggering `emit` calls the handler with the payload; unsubscribe stops it;
  multiple handlers per event supported; an `error` event fires on surfaced `TreatinkError`.
- gate: `npm test -- events`
- refs: `docs/10` §2, Charter §6.2
- note: emission points are asserted in their own phases — `designer:open/close` in P2-T01,
  `draft:saved` in P3-T03, `error` wherever a `TreatinkError` reaches the public boundary.

### P1-T09 · Cutout engine — geometry & transform
- depends_on: [P1-T01]
- does: In `cutout-engine/` (DOM-free), implement the canvas model and transform: constants
  (900×1200, coverage 1.3), the `EditorImage` shape, **initial fit** (`docs/05` §3), drag math
  (`§4`, freeform, no clamp), zoom clamp `[0.5, maxScale]` (`§5`). Port numbers **verbatim** from
  the cited store lines; cite them in comments.
- dod: unit tests assert exact `baseWidth/baseHeight`, `maxScale`, `x/y` for portrait/landscape/
  square inputs matching `docs/05` §3 formulas.
- gate: `npm test -- cutout-engine/geometry`
- refs: `docs/05` §1–§5 (with store citations), `docs/02` §7

### P1-T10 · Cutout engine — render, text, export (canvas injected)
- depends_on: [P1-T09]
- does: Implement compositing (`docs/05` §6: bg → photo(s) translate/rotate/scale-about-center →
  cutout PNG on top → text last), personalization-text placement (`§7`: offsets `160/130/100/320`,
  center X, Mitr auto-fit 68→30 within 40% width, theme color), and the export producing print +
  display + source artifacts plus the low-res flag (`§8`, Charter D.8). Canvas ctx is **injected**;
  no DOM globals. Use `node-canvas`/`@napi-rs/canvas` in tests.
- dod: given an injected canvas, `export()` returns three artifacts + `lowRes`; text lands at the
  correct Y per position; engine imports no DOM globals (lint boundary passes).
- gate: `npm test -- cutout-engine && npm run lint`
- refs: `docs/05` §6–§8, `docs/01` §6, `docs/02` §7

### P1-T11 · Golden-test harness + frozen goldens
- depends_on: [P1-T10, P1-T02]
- does: Build the golden suite per `docs/06` §3: fixture matrix (portrait/landscape/square, 4 text
  positions, low-res case, scale at 1/mid/max, off-center pan), deterministic Node render, hand-
  checked numeric anchors, frozen PNG + numbers, tolerance wired into `npm run test:golden`.
- dod: `npm run test:golden` green; numeric anchors match `docs/05` formulas exactly; re-running is
  stable (deterministic).
- gate: `npm run test:golden`
- refs: `docs/06` §3, §7, `docs/05` §9 (parity is vs. store model, not Appendix D)

---

## Phase 1 exit checklist
- [ ] `npm run verify` green (typecheck + lint + test + size)
- [ ] `npm run test:golden` green with hand-checked anchors
- [ ] `npm run check:no-secret` green
- [ ] Key guard rejects every non-`pk_` key
- [ ] Engine is DOM-free (import-boundary lint passes)
- [ ] Fixtures reproduce the wire contract incl. `failNext`
