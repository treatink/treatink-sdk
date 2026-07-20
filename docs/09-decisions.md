# 09 · Decisions (pinned)

Frozen technical + product decisions so the autonomous loop never stalls on a fork. Changing one is
a deliberate, reviewed edit. Owner decisions (GP-18/19/20) are recorded here as **adopted defaults —
confirm or veto**; the rest (toolchain, GP-11) are pinned engineering choices.

## Owner decisions (minimal-backend posture — GAP-PLAN Part 4)

**Which backend (settled 2026-07-20).** There are two: the **current** Supabase backend
(`api.treatink.com/functions/v1/…`, **session-based** — `api_personalization_sessions`/`session_uuid`,
what rileyspets.com runs today via iframe) and the **new** `treatink-api` FastAPI repo
(`api.treatink.com/v1/…`, **asset-based**, no sessions). **Owner decision: the new asset-based
`treatink-api` is the truth** — it replaces Supabase, and the SDK targets it. This is what makes
GP-18 below firm.

| ID | Decision | Rationale | Status |
|---|---|---|---|
| GP-18 | **Drop `tk.sessions.*` from the public surface.** The SDK is asset-based; the designer's save handles assets internally. | New backend has no sessions; zero fictional endpoints, zero backend additions. | **CONFIRMED** (new backend = truth) |
| GP-19 | **Keep wildcard CORS** (`allow_origins:"*"`, as the API ships today); the SDK does **not** rely on `channel_not_registered`. | No backend change; bearer-key auth is the gate. | **CONFIRMED** |
| GP-20 | **Local preview for MVP.** `DesignerResult.previewUrl` = the in-browser display composite (mockup + label in `label_zone`); no server read-back. | Avoids a backend pk-preview endpoint. Non-durable across reload — documented (GP-08, `docs/05` §8.1). | **CONFIRMED** |

Consequence: the SDK's public surface = `products`, `templates`, `artwork` (asset upload),
`designer`, `drafts`, `orders.buildPayload`, `on`, `TreatinkError` — **no `sessions`**. `docs/04`,
`types.ts`, and Phase 3 follow this.

## Toolchain (GP-11 — pinned)

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript ≥ 5.4, `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` | contract-grade types (`docs/02` §1) |
| Modules / target | ESM only; `ES2020`; browsers per Charter §13 | modern, tree-shakeable |
| Bundler | **tsup** (esbuild) — two entries: browser + `/server`; emits `.d.ts` | minimal config, dual entry, fast; accurate `sideEffects` |
| Package manager | **npm**, lockfile committed | reproducible; no global assumptions |
| Unit + golden tests | **Vitest** | fast, ESM-native, snapshot support |
| Node canvas (engine tests) | **@napi-rs/canvas** | prebuilt binaries (no node-gyp), fast, `toBuffer` PNG |
| E2E | **Playwright** (fixtures mode) | Charter §14 happy path |
| A11y | **@axe-core/playwright** | Charter §7.3 |
| HEIC decode | **heic2any** (lazy chunk), validated for size/decoding; fallback libheif-wasm | Charter §16.9; must stay out of core budget (`docs/06` §2) |
| EXIF orientation | **exifr** (or a minimal inline reader) | orientation correction on ingest |
| Lint | ESLint + typescript-eslint + import-boundary rule | enforces engine DOM-purity (`docs/02` §7) |
| Styling | plain CSS, one injected sheet, `--tk-*` vars — **no CSS-in-JS** | keeps the designer chunk under budget |
| IDs | `crypto.randomUUID()` (browser + Node ≥ 18) | draft ids / idempotency keys |
| Size gate | `size-limit` (or bundler report) wired to budgets | `docs/06` §2 |

Version numbers are pinned in `package.json` at GP-11/Phase-1-T01 time; if a pinned tool proves
unworkable, that's a reviewed decision edit here, not an ad-hoc swap.

## Engine / model decisions (already fixed elsewhere — cross-index)

- Customizer math = store code, not Appendix D (`docs/05`, `README` priority table).
- Single 900×1200 canvas; composite = `toBlob()`; cutout PNG alpha is the mask (`docs/05` §0).
- Asset roles: `source` = original photo, `rendered` = print composite (`docs/04` §2.3, GP-03).
- Two-step upload: declare → presigned PUT → finalize (`docs/04`, GP-04).
- MVP: single photo, no rotation, button/slider zoom (Charter §2; engine ports the general math).
