# 11 · Security & Privacy Checklist

Consolidates the SDK's hard security/privacy constraints (scattered across the Charter §3/§9/§10 and
`docs/02` §6) into one checklist with per-phase gates. Items marked **(gate)** are machine-checked in
`docs/06`; the rest are review items verified before the relevant phase's exit.

## 1. Key discipline (Phase 1)
- **(gate)** `Treatink.init` accepts only `pk_test_`/`pk_live_`; any `sk_*` or non-`pk_` throws
  `key_scope_violation` synchronously. Accepted-prefix list in one constant (`docs/04` §2.1).
- **(gate)** `npm run check:no-secret` — the browser bundle contains **no** secret-key code path and
  does not import `@treatink/sdk/server`.
- Keys go only in `Authorization: Bearer`; never in URLs, query strings, logs, or error messages
  (redact before logging). Verified in review + a log-scrub unit test.

## 2. Photo privacy (Phase 3)
- **(gate)** No image bytes in `localStorage`/IndexedDB — drafts hold references only (`docs/10` §6);
  persistence test asserts stored values are small JSON, never Blob/DataURL/`blob:`.
- Photos travel only to Treatink infra (API host + presigned storage host) over TLS, at save time.
- **(gate)** No third-party requests: e2e asserts the only origins hit are the configured API/CDN/
  storage (+ `blob:`). No analytics, no external fonts (Mitr is bundled — `docs/design-reference` §4),
  no trackers.
- `tk.drafts.clear()` exists for shared-device cleanup; document the save-time upload in partner
  integration docs (Charter §9 disclosure).

## 3. Host-page isolation (Phase 2)
- Light DOM is used (Charter §16.1), so the modal shares the host document. Mitigate collisions:
  scoped reset inside the `tk-` root, `tk-`-prefixed classes only, a high default `zIndex`.
- **XSS discipline:** all user/catalog text (personalization text, titles, tags, copy overrides) is
  rendered as **text nodes / `textContent`**, never `innerHTML`. No `eval`, no `Function`, no
  `dangerouslySetInnerHTML`-equivalent. Reviewed in Phase 2; lint rule bans raw HTML injection.
- Personalization text is length-limited (template-defined) and drawn to canvas as a string — no
  markup path.
- Shadow DOM isolation is the post-MVP hardening step (Charter §2) — not in MVP.

## 4. Transport & uploads (Phase 3/4)
- Presigned PUT URLs are used immediately and never logged or persisted; they are short-lived
  (`docs/08` §6). A failed PUT surfaces `upload_failed`, not a silent retry (`docs/02` §5).
- Client validates `content_type` + `size` (≤ 25 MB) before declaring an asset; computes `sha256`
  locally.
- Idempotent GETs retry with backoff+jitter; writes do not blind-retry.

## 5. Distribution integrity (Phase 4)
- **SRI** hashes published per CDN release; integration docs show the `integrity` attribute.
- Recommended **CSP** shipped to partners: `script-src sdk.treatink.com; connect-src
  api.treatink.com <storage-host>; img-src cdn.treatink.com blob:` (Charter §10.3). Confirm the
  storage host with the backend dev (their concern) before publishing the fragment.
- `async`/`defer` safe; no `document.write`.

## 6. Per-phase security gate summary
| Phase | Must be green |
|---|---|
| P1 | key-guard test · `check:no-secret` · log-scrub test |
| P2 | no-`innerHTML` lint · a11y (indirect) · light-DOM scoping review |
| P3 | persistence (no bytes) test · no-third-party-request e2e · `upload_failed` path |
| P4 | SRI present · CSP fragment shipped · no-third-party-request e2e (live host list) |
