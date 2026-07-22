# 04 · API Reconciliation — Charter vs. Live API

> **⚠️ CORRECTION (real backend now available).** This doc was first written against the *public*
> `api-docs.treatink.com`, which is partly inaccurate. The actual `treatink-api` repo
> (`../treatink-api`, FastAPI/PostgreSQL) has now been read in full. Two corrections matter most:
> **(1)** the backend is **asset-based with NO sessions** — the Charter's session model does not
> exist and should not be built server-side; **(2)** `POST /v1/orders` **does not exist in code**
> (the public docs advertise it, but `/v1/order-ingest` is a *negative* test) — order intake is a
> backend addition, not an existing endpoint. The authoritative gap analysis and the concrete
> additions and how the gaps are filled are in **[`../GAP-PLAN.md`](../GAP-PLAN.md)**.
> Where this doc and `GAP-PLAN.md` disagree, the latter (read from real code) wins. The
> real upload flow is two-step: `POST /v1/assets` (declare) → presigned **PUT** → `POST
> /v1/assets/{id}/finalize`; roles are `source`/`rendered`; catalog cutout-labels already ship
> precomputed alpha geometry (Appendix B is effectively already implemented).

**This is the most important doc for anyone building the live transport.** The Charter (§6, §8.4)
describes a **session-based** API. The currently-published docs at `api-docs.treatink.com` describe
a materially different **asset-based** API. The Charter acknowledges *casing* and the *catalog gap*,
but does **not** acknowledge that the live API has **no sessions at all**.

Owner decision (2026-07-20): **"Brief is the target."** So the Charter's shape is what the SDK's
public surface aims at, and the platform/API team is expected to close the gaps. **But** the SDK is
**fixtures-first**: fixtures implement the Charter contract, and the live `HttpTransport` (Phase 4)
must map to whatever the backend actually ships. Every gap below is therefore a **gated dependency**
on the API team, not something the SDK invents.

> **Consequence for the loop:** Phases 1–3 build entirely against **fixtures** (the Charter
> contract) and are fully gate-able offline. Phase 4 (`HttpTransport` vs. real endpoints) is where
> these gaps bite. Tasks that require a live endpoint absent from the current API are **expected
> blockers** (`AGENTS.md` §5) until the API team confirms them. Do not fake them.

## 1. The REAL live API (verified from `treatink-api` source, not the public docs)

The public `api-docs.treatink.com` snapshot was inaccurate (it listed `/v1/orders`, shipments,
webhooks — none exist — and omitted the real asset/cutout endpoints). This is the **actual**
registered surface (`application.py` + `*/composition.py`):

| Method | Path | Key scope | Purpose |
|---|---|---|---|
| GET | `/v1/channel` | pk/sk (`channel_read`) | channel metadata |
| GET | `/v1/catalog/products` | pk (`catalog_read`) | products (`?include=variants`) |
| GET | `/v1/catalog/variants` | pk | variants (SKU, pricing, `label_zone`) |
| GET | `/v1/catalog/bundles` | pk | bundles |
| GET | `/v1/catalog/cutout-labels` | pk | seeded cutout templates (+ precomputed geometry) |
| POST | `/v1/assets` | pk (`artwork_upload`) | declare asset → presigned PUT |
| POST | `/v1/assets/{id}/finalize` | pk | finalize uploaded asset |
| GET | `/v1/assets/{id}` | **sk** (`personalization_read`) | read asset (server-only) |
| POST/GET | `/v1/cutout-labels`, `…/{id}/finalize`, `…/{id}` | **sk** (`cutout_label_manage`) | custom partner masks |
| GET/PUT | `/v1/cutout-label-selections` | sk | partner default-cutout preference |
| POST | `/v1/orders` | **sk** (`order_manage`) | create order (LIVE 2026-07-22; requires `Idempotency-Key`) |
| GET | `/v1/orders/{id}` · `/v1/orders` | **sk** | read order / cursor-paged summaries |

**UPDATE 2026-07-22:** `/v1/orders` now EXISTS (POST/GET, sk-only — see rows above and §2.7).
Still absent from the machine surface: sessions, webhooks, machine shipments (shipments are
portal-only: `/v1/partner/accounts/{id}/orders/{id}/shipments`, human-cookie auth — not for the
SDK). Auth: `Authorization: Bearer <key>` only — **no channel header** (tenant derives from the
key; see §2.8). Keys `pk_(test|live)_<22>_<43>` / `sk_(test|live)_<22>_<43>` — confirmed unchanged;
`key_<32hex>` strings are credential PUBLIC IDs (portal listings), not bearer keys. Error envelope
`{ error:{ type, code, message, param, request_id } }`; statuses
400/401/403/404/405/409/413/415/422/**503**. `Idempotency-Key` header: REQUIRED on POST /v1/orders,
admitted by machine CORS (`MACHINE_CORS_ALLOW_HEADERS`, errors.py:288-293). Hosts (2026-07-22):
production `https://treatinkapi.com`, staging `https://staging.treatinkapi.com`
(`api.treatink.com` is legacy).
Assets: roles `source|rendered` only, ≤ 50 MB, pending expires in 900 s, unreferenced expire ~30 days.

## 2. Field-by-field reconciliation

Legend — **Resolution**: `FIXTURE` = fixtures implement the Charter shape now; `LIVE-GAP` = live
API differs, needs API-team work before live mode; `DOCS` = docs-alignment only; `SDK` = SDK-side
choice.

### 2.1 Keys
| Charter | Live | Resolution |
|---|---|---|
| `tk_pub_…` / `tk_live_…` | `pk_test_/pk_live_` (browser), `sk_test_/sk_live_` (server) | **LIVE-GAP + SDK.** Key-prefix guard must accept the **real** prefixes. Guard rule: browser build accepts **only** `pk_` keys; anything starting `sk_` (or the Charter's `tk_live_`) throws `key_scope_violation`. Treat `pk_`/`sk_` as canonical; keep the guard's accepted-prefix list in one constant so a rename is one edit. Do **not** hard-code only `tk_pub_`. |

### 2.2 Sessions — RESOLVED: dropped (GP-18)
| Charter | Live | Resolution |
|---|---|---|
| `POST /v1/sessions`, lifecycle `open→completed→ordered`; save pipeline session-centric (§8.4) | **No sessions endpoint exists.** The backend is asset-based. | **DECIDED (GP-18): drop `tk.sessions.*` from the public surface.** The SDK is asset-based end to end; the designer's save orchestrates assets internally. No `sess_…` ids anywhere. This removes a fictional endpoint and needs **zero backend**. (Prior art: the store's own API mode uses a `sessionUuid` internally — but the public SDK doesn't expose sessions.) |

### 2.3 Artwork / assets — RESOLVED: the two-step asset model is the contract (GP-03/04)
The **real, authoritative upload flow** (from `../treatink-api` `personalization_media`) — this is
what fixtures and `HttpTransport` both implement (definitive JSON in `docs/08-fixtures-contract.md`):

```
1. POST /v1/assets            (pk, scope artwork_upload)
     body: { role: "source"|"rendered", content_type, size_bytes, sha256 }   # client computes sha256+size
     201 -> { id: "ast_…", role, status:"pending", …, pending_expires_at,
              upload: { method:"PUT", url:"<presigned>", headers:{…} } }
2. PUT <upload.url>           (browser → object storage, with upload.headers; the raw bytes)
3. POST /v1/assets/{id}/finalize   (pk; empty body)
     200 -> { id, role, status:"final", width, height, sha256, finalized_at }   # NO url (see GP-08)
```

| Charter | Real backend | Resolution |
|---|---|---|
| `POST /v1/artwork`, slots `original_image\|front_label\|back_label`, one multipart POST | two-step declare→PUT→finalize; roles `source`/`rendered`; ≤ 50 MB | **DECIDED.** `tk.artwork.upload({ role, file })` runs the 3-call sequence. Map `original_image→source` (original photo), `front_label→rendered` (print composite). No `back_label` (single-sided MVP). Enforce the stricter **25 MB** client-side (`upload_too_large`/413 on the wire). Fixtures simulate presign + local object URL; no network. **Preview URL is produced locally** (GP-08), since finalize returns no URL and the pk key can't GET the asset. |

### 2.4 Catalog: products & variants
| Charter | Live | Resolution |
|---|---|---|
| `GET /v1/products` (proposed), SKU on product; `tk.products.get(sku)` | `GET /v1/catalog/products` (families) + `GET /v1/catalog/variants`; **SKU lives on the variant**; `?include=variants` | **SDK + LIVE-GAP.** This is real and documented — build the live path to `/v1/catalog/*`. **Critical modeling difference:** a Charter "product+SKU" is a live **variant**. The catalog adapter (`catalog/adapter.ts`) must resolve a `sku` to `{ productFamily, variant }` and expose the Charter-shaped `products.get(sku)`. Product carries `label_zone`, `animal_type`, `category`, `image_url`; variant carries `sku`, `option_values`, pricing, `inventory`. |

### 2.5 Templates / cutouts
| Charter | Live | Resolution |
|---|---|---|
| `GET /v1/templates?sku=`, filtered by zone aspect | **Not documented anywhere** | **FIXTURE + LIVE-GAP.** Fixtures implement Appendix B (provisional). No live endpoint exists → live templates are a hard **Phase-4 blocker** on the API team. The designer must run fully on fixture templates. The store ships its frames as static assets (`/frames/*.png`, ~95) with `category`/`theme`/`petNamePosition` metadata — usable to seed fixtures. |

### 2.6 Personalization text
| Charter | Live | Resolution |
|---|---|---|
| Native `personalization_text`; `animal_type` deprecated | Backend catalog has `pet_name_position` (layout) + `animal_type`; **no customer-name field** (there is no order endpoint) | **SDK.** SDK public copy uses `personalizationText`; "Pet Name" is Riley's channel copy. On the wire, the customer name lives in the SDK-proposed **order body** as `personalization.personalization_text` (`docs/08` §7) — the single source of truth. `animal_type` is neither sent nor surfaced by the SDK (subject selection deferred), so no rename is required backend-side. |

### 2.7 Orders — LIVE (2026-07-22); the wire schema in `docs/08` §7 is now the REAL one

`POST /v1/orders` is registered in production (`orders/composition.py`), **secret-key** scope
(`order_manage` — a pk gets 403). The earlier SDK-proposed body is superseded by the real strict
schema: `recipient`/`destination`/`fulfillment`/`amounts`/`line_items`; per-line
`personalization = { source_asset_id, rendered_asset_id, cutout_label_id|null, pet_name|null }` —
**no** `personalization_text`/`pet_name_position`/`image_metadata`/`label_zone` on the wire (the
print pipeline consumes the `rendered` asset directly; transform context stays in the draft,
`docs/05` §8.2 note). `currency` = `"USD"` only. Idempotency = required `Idempotency-Key` header
(scoped per partner+mode; conflict → 409 `idempotency_conflict`) + a separate per-scope uniqueness
constraint on `external_order_id`. `buildPayload` emits the exact body (explicit nulls);
`@treatink/sdk/server.submitOrder` sends the header (default = `external_order_id`).

### 2.8 Channel header
| Charter | Live | Resolution |
|---|---|---|
| `X-TreatInk-Channel` auto-sent | **No channel header.** Tenant/channel derives entirely from the bearer key's account. CORS `allow_headers` is **only** `Authorization, Content-Type` (`application.py:150`). | **DECIDED: do NOT send a channel header in browser/live mode.** A preflight carrying `X-TreatInk-Channel` would be **rejected** (`400 bad_request`) by the canonical CORS middleware — it is *not* harmless. The channel is identified by the publishable key (issued per channel). `Treatink.init({ channel })` is used SDK-side for draft namespacing/validation only, not sent as a header. Confirm channel via `GET /v1/channel` if needed. |

### 2.9 Casing
| Charter | Live | Resolution |
|---|---|---|
| "Treatink"; global `Treatink` | Live docs already say "Treatink" consistently | **DOCS.** Already aligned. Use `Treatink` everywhere. The header token casing (`X-TreatInk-Channel`) is cosmetic (HTTP headers are case-insensitive). |

### 2.10 Shipments & webhooks
| Charter | Live | Resolution |
|---|---|---|
| Not in Charter scope | Shipments exist only on the PARTNER-PORTAL surface (`/v1/partner/...`, human-cookie auth) — no machine shipments/webhooks endpoints | **OUT OF SCOPE (MVP).** Not part of the SDK MVP; the portal surface is not the SDK's. |

## 3. Gated dependencies on the API/platform team

These must be resolved before **live mode** (Phase 4) can be fully green. Each is an expected
blocker until confirmed. (Charter §17 lists most as open items.)

1. **Sessions**: will the API add a sessions layer, or does the SDK map `sessions.*` onto assets?
   (Blocks 2.2, 2.3, 2.5 live paths.)
2. **Templates endpoint**: `GET /v1/templates` doesn't exist. (Blocks live designer catalog.)
3. **Catalog contract finalization**: Appendix B is provisional; live is `/v1/catalog/*` with
   variants. (Adapter absorbs churn, but the final shape must be confirmed.)
4. **Wire renames**: `personalization_text`, `animal_type` deprecation — land API-side or keep the
   adapter mapping.
5. **CORS policy**: origins matching registered channel hostnames; mismatch → `403
   channel_not_registered` (Charter §10.2). Required for any browser call in live mode.
6. **Key prefixes**: confirm `pk_`/`sk_` are canonical (they are, per live docs) — the guard is
   built to the real prefixes.
7. **Orphaned-asset retention**: upload-on-save creates assets before purchase (assets expire in 30
   days per live docs — good, but confirm this covers abandoned designs).

## 4. Rules this doc imposes on the build

- **Fixtures implement the Charter contract** (session-based, Charter names). They are the default
  mode and make Phases 1–3 fully buildable and gate-able offline.
- **`buildPayload` targets the live order schema** (§2.7) — it's the one place the live shape is
  both real and stable.
- **All wire-shape differences live in adapters** (`catalog/adapter.ts`, transport mapping), never
  scattered. A backend change is a one-file edit.
- **No task may assume a live endpoint that §1 doesn't list.** If it does, it's a Phase-4 blocker.
