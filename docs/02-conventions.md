# 02 · Conventions

Coding standards for `@treatink/sdk`. These are enforced by gates where possible (`docs/06`) and by
review where not. Agents follow them without exception; deviations are blockers, not liberties.

## 1. Language & tooling

- **TypeScript, strict.** `tsconfig` has `strict: true`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`. Zero `tsc --noEmit` errors is a gate.
- **ESM only.** No CommonJS in source. Server entry is ESM too (Node ≥ 18).
- **No `any`.** Use `unknown` + narrowing. `any` is allowed only with an inline
  `// eslint-disable-next-line` and a one-line justification; reviewers may reject it.
- **Build:** the bundler is chosen in Phase 1 (`tsup` or `vite lib` — see `phases/01-core.md`).
  Two outputs: browser bundle + `/server`. Tree-shakeable, `sideEffects` accurate.
- **Node ≥ 18**, npm (lockfile committed). No global installs assumed by scripts.

## 2. Public API is the contract

- The public surface is exactly `docs/10-public-types.md` (`Treatink.init`, `tk.products/templates/
  artwork/designer/drafts/orders`, `tk.on`, `TreatinkError` — **no `sessions`**, GP-18). **Types in
  `src/types.ts` are the source of truth** and match `docs/10`, shipping with the package.
- Do not add public surface not in the Charter without an owner decision (that's a blocker).
- Everything else is internal and must not be exported from `index.ts`.
- Naming: **`Treatink`** everywhere (never `TreatInk`) — prose, the JS global, error copy
  (Charter §12/§16.8).

## 3. Naming & files

- Files `kebab-case.ts`; types `PascalCase`; functions/vars `camelCase`; constants `UPPER_SNAKE`.
- One primary export per file where practical; co-locate a file's unit tests as `x.test.ts`.
- DOM classes are **`tk-`-prefixed** (`tk-modal`, `tk-header`, `tk-zoom-in`) and are a documented,
  stable part of the theming contract — renaming one is a breaking change.
- CSS custom properties are `--tk-*` and derive from `ThemeConfig`.

## 4. Error model (Charter §6.5)

- All failures surface as `TreatinkError { code, status?, message, param?, requestId? }` — mirroring
  the real envelope `{ error: { type, code, message, param, request_id } }` (`../treatink-api`
  `errors.py`).
- `code` is one of the **real API codes** (confirmed from the backend, GP-06) **or** an SDK-local
  code. Keep this set centralized in `transport/errors.ts`; do not scatter string literals.

  | HTTP | API codes (real) |
  |---|---|
  | 400 | `bad_request`, `invalid_cursor` |
  | 401 | `invalid_api_key` |
  | 403 | `insufficient_permissions` |
  | 404 | `not_found` |
  | 409 | `upload_quota_exceeded`, `upload_incomplete`, `upload_expired`, `asset_not_final`, `cutout_label_not_final` |
  | 413 | `upload_too_large` |
  | 415 | `unsupported_media_type` |
  | 422 | `validation_error`, `upload_validation_failed` |
  | 503 | `service_unavailable` |

  **SDK-local codes** (never from the wire): `key_scope_violation` (secret key in browser),
  `unsupported_file_type` (client-side pre-upload validation), `upload_failed` (browser PUT to the
  presigned URL failed).
  **Superseded Charter codes** (do NOT use — no backend equivalent): `invalid_request` →
  `bad_request`; `channel_not_registered` → dropped (GP-19, wildcard CORS); `session_*` → dropped
  (GP-18, no sessions). Map the file-size guard to `upload_too_large`/413 to match the API.
- **Fixture mode produces identical error objects** to live mode (Charter §11). A test asserting on
  a code must pass in both modes.
- Never throw bare `Error` across the public boundary. Never leak transport/internal errors raw.

## 5. Async, network, retry (Charter §10.2)

- The transport is the only place `fetch` is called.
- Idempotent GETs: retry with **exponential backoff + jitter**. Non-idempotent writes: do **not**
  blind-retry. Artwork upload surfaces `upload_failed` to the UI rather than retrying silently.
- Every request carries `Authorization: Bearer <publishable key>` — and **no channel header** (the
  real API keys the tenant off the key, and its CORS allow-list rejects extra headers; `docs/04`
  §2.8). Never a secret key in the browser build.
- No request may go to any host other than the configured API/CDN. No analytics/font/tracker calls.

## 6. Privacy & security (Charter §3, §9, §10 — hard constraints)

- **No image bytes persisted client-side** — not `localStorage`, not IndexedDB. Drafts store
  *references only* (`docs/05` §Persistence, Charter §9). Reviewers grep for blob writes.
- Photos travel only to Treatink infra over TLS, at save time; never logged, never third-party.
- Keys never logged, never in URLs. Secret keys never in the browser build (`docs/01` §7).
- Provide `tk.drafts.clear()` for shared-device cleanup.

## 7. The cutout engine stays pure

- `cutout-engine/` imports **no** DOM globals (`window`, `document`, `HTMLCanvasElement` types are
  fine; instances are injected). Enforced by an import-boundary lint rule (gate in `docs/06`).
- Its numbers come from `docs/05-engine-reference.md`, which cites the store code. If you find
  yourself inventing a constant, stop — find it in the store code or park a blocker.

## 8. Tests

- **Unit** (Vitest): pure logic, engine math, adapters, error mapping.
- **Golden** (engine): committed reference outputs; ported engine must match within the stated
  pixel tolerance (`docs/06`). This *defines* a correct port.
- **E2E** (Playwright, fixtures mode): the happy path + failure paths (Charter §14).
- **A11y** (axe): the modal.
- Tests are written **with** the task that introduces the behavior, never deferred. A task's gate
  includes its tests.
- Deterministic: no real network, no wall-clock/random in assertions (seed or inject).

## 9. Comments & docs

- Comment the **why**, not the what. Where a value is ported, cite it:
  `// ported from treatink useFileHandlers.js:74-79 (maxScale)`.
- Public API gets TSDoc; it feeds the published types and integration docs.
- Match the surrounding style; do not reformat untouched code.

## 10. Commits & scope discipline

- One task → one commit, message prefixed with the task ID (`AGENTS.md` §7).
- No drive-by refactors. If you spot unrelated debt, note it in `STATE.md` "Parking lot", don't fix
  it inline.
- Never commit red/skipped gates, `node_modules`, build output, secrets, or real API keys.
