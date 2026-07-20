# Phase 04 · Live & Pilot (Charter M4)

**Goal:** wire `HttpTransport` against staging behind the `mode` flag, verify CORS, update the API
docs, deploy on Riley's replacing the iframe, and publish the bundle at the documented URL — tag
MVP.

**This is where the live backend meets the SDK.** A few tasks depend on **backend/infra the SDK
doesn't own** (the order endpoint, storage-bucket CORS — GAP-PLAN "Out of scope"). Those are
**expected parks** (`AGENTS.md` §5) until the backend dev ships them — a clean outcome, not a
failure. Templates and assets already exist live (catalog cutout-labels + `/v1/assets`), so most of
P4 is real work; do **not** fake anything that isn't there yet.

**In scope:** `HttpTransport` (fetch, auth, channel header, retry/backoff); mode switch parity with
fixtures; CORS verification; api-docs update pass; SRI + CSP guidance; Riley's deployment; publish.
**Out of scope:** anything Deferred (Charter §2/§17): Shadow DOM, `mount()`, `sessions.update`,
facets, pinch/keyboard.

**Entry gate:** Phase 3 exit green (full fixtures happy path).
**Exit gate:** live smoke against staging green **or** all live gaps parked as documented blockers;
bundle published at `sdk.treatink.com/v1/treatink.js`; MVP DoD (Charter §14 / `phases/00`) checked.

**Read first:** `docs/04-api-reconciliation.md` (entirely), Charter §10, §16, §17, `docs/01` §4, §7.

---

### P4-T01 · HttpTransport (catalog + orders — the real, documented paths)
- depends_on: []
- does: Implement `HttpTransport` for the endpoints that **actually exist** today (`docs/04` §1):
  `GET /v1/channel`, `GET /v1/catalog/products`+`?include=variants`, `GET /v1/catalog/variants`
  (via the adapter, `docs/04` §2.4), and — through `@treatink/sdk/server` — `POST /v1/orders`.
  Auth `Bearer pk_…` (browser) / `sk_…` (server); channel header; idempotent GET retry w/ backoff
  + jitter; error-envelope → `TreatinkError`.
- dod: against staging (or a documented mock of the live contract), catalog + `submitOrder` work;
  errors map correctly; mode swap changes nothing above the transport.
- gate: `npm run test:e2e -- http-catalog-orders` (staging or contract-mock)
- refs: `docs/04` §1, §2.4, §2.7, §2.8, `docs/01` §4, Charter §10.2

### P4-T02 · Live asset upload (two-step, against real storage)
- depends_on: [P4-T01]
- does: Wire `artwork.upload` to the real two-step flow: `POST /v1/assets` (declare) → browser **PUT**
  to the presigned storage URL → `POST /v1/assets/{id}/finalize`, for `role:source` and
  `role:rendered` (`docs/04` §2.3, `docs/08` §6). No sessions (already dropped, GP-18). Asset ids flow
  into `buildPayload`.
- dod: source + rendered assets upload against staging; ids appear in `buildPayload`
  (`source_asset_id`/`rendered_asset_id`); `previewUrl` still local (GP-08).
- gate: `npm run test:e2e -- http-assets` (staging)
- refs: `docs/04` §2.3, `docs/08` §6
- **Dependency (not SDK):** the browser PUT needs **storage-bucket CORS** for channel origins
  (GAP-PLAN Out-of-scope / GP-02, backend/infra). If not yet configured, this task parks with
  *unblock = storage CORS deployed*; fixtures cover the flow meanwhile.

### P4-T03 · Live templates — EXPECTED BLOCKER
- depends_on: [P4-T01]
- does: Point `templates.list` at the live templates endpoint.
- dod: designer loads live cutouts for a SKU.
- gate: `npm run test:e2e -- http-templates` (staging)
- refs: `docs/04` §2.5, §3(2)
- **Blocker note:** `GET /v1/templates` **does not exist** in the live API. Park: *unblock =
  API-team ships a templates endpoint (or confirms cutouts ship via catalog).* Designer runs on
  fixture templates until then.

### P4-T04 · CORS verification — EXPECTED BLOCKER
- depends_on: [P4-T01]
- does: Verify browser calls from a registered channel origin succeed and a mismatched `Origin`
  yields `403 channel_not_registered` (Charter §10.2 proposed policy).
- dod: documented CORS behavior confirmed against staging.
- gate: manual/e2e CORS check against staging (documented result)
- refs: `docs/04` §2.8, §3(5), Charter §10.2
- **Blocker note:** depends on the API team implementing the per-channel CORS policy. Park:
  *unblock = CORS policy deployed on staging.*

### P4-T05 · API-docs update pass
- depends_on: [P4-T01]
- does: Drive the documentation changes the Charter requires (§4, §17): modal architecture replacing
  iframe language; `Treatink` casing + global; `personalization_text`; `animal_type` deprecation;
  upload-at-design flow; `image_metadata` context. Track as a checklist; this is a docs deliverable,
  not SDK code.
- dod: each item filed/updated (or handed to the docs team with exact diffs).
- gate: checklist in `STATE.md` complete (human-verified)
- refs: Charter §4, §12, §17, `docs/04` §2

### P4-T06 · SRI + CSP + privacy guidance
- depends_on: [P4-T01]
- does: Publish SRI hashes per release; ship the recommended CSP fragment (`script-src
  sdk.treatink.com; connect-src api.treatink.com; img-src cdn.treatink.com blob:`) and the §9 privacy
  disclosure note in integration docs. Add an e2e assertion that no third-party origins are hit.
- dod: CSP/SRI documented; no-third-party-request test green.
- gate: `npm run test:e2e -- no-third-party`
- refs: Charter §10.3, §9, `docs/06` §6

### P4-T07 · Publish + Riley's pilot
- depends_on: [P4-T01, P4-T06]
- does: Build and publish the bundle to `sdk.treatink.com/v1/treatink.js` (loader + lazy designer
  chunk, SRI). Deploy on rileyspets.com replacing the iframe. Tag MVP. (Live-mode fullness depends
  on P4-T02/T03/T04 unblocking; the pilot may run in a hybrid/fixtures-backed mode if those are
  still parked — document what's live vs. simulated.)
- dod: bundle reachable at the documented URL; Riley's page renders the native modal; MVP tagged.
- gate: live smoke test at the published URL (documented result)
- refs: Charter §4, §15 (M4), §14

### P4-T08 · Release pipeline (GP-15)
- depends_on: [P4-T06]
- does: Automate the dual release. **CDN:** build the loader + lazy chunks, compute **SRI** hashes,
  upload to `sdk.treatink.com/v1/` (immutable per release; `/v1/` is the non-breaking compatibility
  channel), publish the SRI + `integrity` snippet. **npm:** `npm publish @treatink/sdk` (browser +
  `/server` entries, types), semver, generated `CHANGELOG`. CI enforces `size` budgets + `check:no-
  secret` before publish. Tag the release.
- dod: a tagged release produces the CDN bundle (with SRI) at the documented URL and an npm version;
  budgets + no-secret gates block a bad publish.
- gate: dry-run publish + `npm run size && npm run check:no-secret` green (documented result)
- refs: Charter §4, §13, `docs/06` §2/§6, `docs/11` §5

---

## Phase 4 exit checklist / MVP DoD (Charter §14)
- [ ] `HttpTransport` for real documented paths (catalog + orders) green against staging
- [ ] Live two-step asset upload + templates (catalog): green; storage-CORS/order-endpoint parked if backend not ready
- [ ] api-docs update items filed
- [ ] SRI + CSP + privacy note shipped; no third-party requests
- [ ] Bundle published at `sdk.treatink.com/v1/treatink.js`
- [ ] Riley's runs the native modal (no iframe); MVP tagged
- [ ] Cold-dev integration in fixtures < 1 day; golden tests pass; no secret key in browser bundle;
      budgets hold
