# 08 · Fixtures Contract — exact wire shapes

The `FixtureTransport` must reproduce these bodies **exactly** (field names, nesting, id prefixes) so
switching to live is a config change, not a rewrite (Charter §1). All shapes below are copied from
the real `treatink-api` response/request models (`modules/catalog/schemas.py`,
`modules/personalization_media/schemas.py`, `modules/partner_access/schemas.py`, `errors.py`).
Catalog + media response models use `extra="forbid"` (do not add fields); `ChannelResponse` uses
`frozen=True` instead — treat all as exact-shape. `PublicDecimal` serializes as a JSON float.

> The SDK's `catalog/adapter.ts` normalizes these into the internal model; **fixtures emit these wire
> shapes**, the adapter maps them. Keep raw wire shapes here; keep the internal model in code.

## ID prefixes
`chn_` channel · `key_` credential · `prd_` product · `var_` variant · `bnd_` bundle ·
`cut_` cutout-label (shared seeded+custom namespace) · `ast_` artwork asset.
Patterns: `^prd_[0-9a-f]{32}$`, `^var_…`, `^cut_…`, `^ast_…`.

## Pagination
Every catalog list is `CatalogPage`: `{ "data": [ … ], "has_more": bool, "next_cursor": string|null }`.
Query params (`extra="forbid"`): `limit` (1–100, default 20), `cursor` (string|null).

---

## 1. `GET /v1/channel` — `ChannelResponse` (pk or sk)
```json
{ "id": "chn_0000000000000000000000000000000a", "name": "Riley's Pets",
  "mode": "test", "key_class": "publishable",
  "permissions": ["artwork_upload", "catalog_read", "channel_read"] }
```

## 2. `GET /v1/catalog/products` — `ProductPage` (pk) — `?include=variants` supported
```json
{ "data": [
    { "id": "prd_0000000000000000000000000000abcd",
      "title": "Training Treats for Dogs (6oz)",
      "description": "…", "animal_type": "dog",
      "category": "treats", "product_type": "treats", "status": "active" }
  ],
  "has_more": false, "next_cursor": null }
```
`animal_type` ∈ `cat|dog|horse`. `category` ∈ `health|treats`. `product_type` ∈
`biscuits|dental_treats|soft_treats|treats`. `status` = `active`.

## 3. `GET /v1/catalog/variants` — `VariantPage` (pk)  ← SKU lives here
```json
{ "data": [
    { "id": "var_0000000000000000000000000000ef01",
      "product_id": "prd_0000000000000000000000000000abcd",
      "sku": "SSGTTBC", "description": "…", "short_description": "…",
      "option_values": { "flavor": "peanut_butter" },
      "currency": "USD", "suggested_retail_cents": 999,
      "availability": "available",
      "fulfillment_eligibility": { "policy": "deny_unlisted", "country_codes": ["US"] },
      "catalog_image":          { "url": "https://cdn.treatink.com/…", "expires_at": "2026-08-19T00:00:00Z",
                                  "content_type": "image/png", "size_bytes": 123456, "width": 1000, "height": 1000,
                                  "sha256": "…" },
      "regulatory_label_image": { "url": "…", "expires_at": "…", "content_type": "image/png",
                                  "size_bytes": 1234, "width": 500, "height": 700, "sha256": "…" },
      "label_zone": { "x": 0.321, "y": 0.316, "width": 0.358, "height": 0.478 } }
  ],
  "has_more": false, "next_cursor": null }
```
`MediaResponse` = `{ url, expires_at, content_type, size_bytes, width, height, sha256 }`.
`label_zone` is normalized (may be `null` — include a no-zone edge-case fixture).

## 4. `GET /v1/catalog/bundles` — `BundlePage` (pk)
```json
{ "data": [
    { "id": "bnd_…", "name": "…", "description": "…", "animal_type": "dog",
      "currency": "USD", "raw_total_cents": 1998, "discount_cents": 200,
      "suggested_retail_cents": 1798, "variant_ids": ["var_…", "var_…"] } ],
  "has_more": false, "next_cursor": null }
```

## 5. `GET /v1/catalog/cutout-labels` — `CutoutLabelPage` (pk)  ← the designer's templates
```json
{ "data": [
    { "id": "cut_0000000000000000000000000000aa01",
      "title": "Classic Frame", "category": "standard", "theme": "light",
      "pet_name_position": "bottom", "description": "…", "tags": ["yellow", "hearts"],
      "mask": { "url": "https://cdn.treatink.com/…png", "expires_at": "…",
                "content_type": "image/png", "size_bytes": 34567, "width": 900, "height": 1200, "sha256": "…" },
      "canvas": { "width": 900, "height": 1200 },
      "placement": { "…": "opaque geometry pass-through" },
      "alpha_threshold": 8,
      "center_pixel_alpha": 0,
      "alpha_stats": { "total_pixels": 1080000, "fully_transparent_pixels": 432000,
                       "semitransparent_pixels": 1200, "opaque_pixels": 646800,
                       "fully_transparent_fraction": 0.4, "semitransparent_fraction": 0.001111,
                       "opaque_fraction": 0.598889 },
      "fully_transparent_bounds": {
        "pixels": { "x": 127, "y": 306, "width": 649, "height": 667,
                    "right_exclusive": 776, "bottom_exclusive": 973 },
        "normalized": { "x": 0.141111, "y": 0.255, "width": 0.721111, "height": 0.555833 },
        "pixel_count": 432000 },
      "non_opaque_bounds": { "pixels": { … }, "normalized": { … }, "pixel_count": 433200 },
      "center_transparent_component": {
        "pixels": { … }, "normalized": { … }, "pixel_count": 430000,
        "start_pixel": { "x": 450, "y": 600, "alpha": 0 }, "touches_canvas_edge": false },
      "largest_safe_transparent_rectangle": {
        "pixels": { … }, "normalized": { … }, "pixel_area": 300000 } }
  ],
  "has_more": false, "next_cursor": null }
```
`category` ∈ `standard|holidays|birthdays|occasions` (drives the designer tab bar). `theme` ∈
`light|dark`. `pet_name_position` ∈ `default|top|upper|bottom` (the text-placement hint, `docs/05`
§7). Rectangle sub-shape: `{ pixels:{x,y,width,height,right_exclusive,bottom_exclusive},
normalized:{x,y,width,height} }`; measured bounds add `pixel_count`; component adds `start_pixel` +
`touches_canvas_edge`; safe-rect adds `pixel_area`. **The SDK never decodes alpha at runtime — it
consumes this precomputed geometry.**

---

## 6. Asset upload — the two-step flow (pk, scope `artwork_upload`)

### 6a. `POST /v1/assets` → `ArtworkPendingResponse` (201)
Request `ArtworkCreateRequest` (client computes `sha256` + `size_bytes` before calling):
```json
{ "role": "source", "content_type": "image/png", "size_bytes": 2456789,
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }
```
Response:
```json
{ "id": "ast_0000000000000000000000000000b101", "role": "source", "status": "pending",
  "content_type": "image/png", "size_bytes": 2456789, "sha256": "e3b0…b855",
  "created_at": "2026-07-20T12:00:00Z", "pending_expires_at": "2026-07-20T12:15:00Z",
  "upload": { "method": "PUT", "url": "https://storage.treatink.com/…?X-signed=…",
              "expires_at": "2026-07-20T12:10:00Z",
              "headers": { "Content-Type": "image/png" } } }
```
`role` ∈ `source|rendered`. `size_bytes` ≤ 50,000,000 (SDK enforces stricter 25 MB client-side).

### 6b. `PUT <upload.url>` — browser → object storage
Send the raw bytes with exactly `upload.headers`. Not the Treatink API host. On network/CORS failure
the SDK surfaces `upload_failed` (SDK-local). **Fixtures skip this** — "upload" becomes a local
object URL.

### 6c. `POST /v1/assets/{ast_id}/finalize` → `ArtworkFinalResponse` (empty request body)
```json
{ "id": "ast_…b101", "role": "source", "status": "final",
  "content_type": "image/png", "size_bytes": 2456789, "width": 2048, "height": 1536,
  "sha256": "e3b0…b855", "created_at": "2026-07-20T12:00:00Z",
  "finalized_at": "2026-07-20T12:01:00Z" }
```
**No URL is returned** (and `GET /v1/assets/{id}` is secret-only) → the SDK builds `previewUrl`
locally from the in-browser composite (GP-08). Finalize errors: `409 upload_expired`,
`409 upload_incomplete`, `422 upload_validation_failed`.

The save pipeline runs 6a–6c twice: `role:source` (original photo) and `role:rendered` (print
composite). The two `ast_` ids flow into `orders.buildPayload`.

---

## 7. Order — the REAL `POST /v1/orders` body (sk, scope `order_manage`) — LIVE 2026-07-22

The endpoint is registered in production (`orders/composition.py`). The schema is **strict**
(`extra="forbid"`; nullable fields must be PRESENT as explicit `null`). Requires an
`Idempotency-Key` header (1–255 visible-ASCII; scoped per partner+mode; same key + different body →
`409 idempotency_conflict`); `external_order_id` also has its own per-scope uniqueness constraint.
`orders.buildPayload()` assembles exactly this; `submitOrder` sends the header (default =
`external_order_id`):
```json
{ "external_order_id": "partner-1001", "display_order_number": "#1001",
  "currency": "USD",
  "recipient": { "name": "A B", "email": "a@b.com", "phone": null },
  "destination": { "address_line_1": "1 St", "address_line_2": null, "city": "X",
                   "region": "CA", "postal_code": "90000", "country_code": "US" },
  "fulfillment": { "delivery_method": "ship_to_recipient", "instructions": null },
  "amounts": { "subtotal_cents": 999, "discount_cents": 0, "shipping_cents": 295,
               "tax_cents": 0, "total_cents": 1294 },
  "line_items": [
    { "external_line_item_id": "li-1", "variant_id": "var_…", "quantity": 1,
      "unit_price_cents": 999, "subtotal_cents": 999,
      "personalization": { "source_asset_id": "ast_…b101", "rendered_asset_id": "ast_…b102",
                           "cutout_label_id": "cut_…aa01", "pet_name": "Milo" } }
  ] }
```
Wire rules: `currency` is `"USD"` only; recipient needs ≥ 1 of email/phone;
`external_line_item_id` required + unique; 1–100 lines; `delivery_method` is always
`"ship_to_recipient"`. **The wire carries NO transform / pet-name position / label zone / sku** —
the print pipeline uses the `rendered` asset directly; that context stays client-side in the draft
(`docs/05` §8.2 note). Order `status` vocabulary: `received | in_production | shipped | rejected |
cancelled` (creation returns `received`).

Fixture response mirrors the real `OrderResponse` essentials: `{ "id": "ord_fx_…",
"status": "received", "external_order_id": "partner-1001", "display_order_number": "#1001"|null,
"created_at": "…", "line_items": [ { "id": "…", "external_line_item_id": "li-1",
"variant_id": "var_…", "quantity": 1 } ] }`. The fixture stays idempotent on
`external_order_id`.

---

## 8. Error envelope — every failure
```json
{ "error": { "type": "invalid_request_error", "code": "upload_too_large",
             "message": "…", "param": "size_bytes",
             "request_id": "req_fx_000001" } }
```
`type` varies by class: **4xx request** → `invalid_request_error`; **401** → `authentication_error`;
**403** → `permission_error`; **503** → `service_unavailable`-family. Fixtures must set the matching
`type` per code, not hard-code `invalid_request_error`. Codes/status per `docs/02` §4 (incl. `503
service_unavailable`). `FixtureTransport.failNext(op, { status, code })` produces this exact envelope
on demand; fixtures also set a `request_id`.

---

## 9. Fixture data set — seed extraction (Charter §11, GP-10)
14 products, ~95 cutout-labels, incl. edge cases: a product with `label_zone: null`, a slug/sku
collision, the storefront-only Riley's product, and ≥1 non-pet (`animal_type` variety). Cutout-label
geometry is precomputed (§5). Deterministic ids (`prd_fx_…`, `var_fx_…`, `cut_fx_…`, `ast_fx_…`,
`ord_fx_…`).

**Exact sources to extract from (executed in Phase 1 T07/T10):**
- **Cutout PNGs** — `../treatink/web/public/frames/*.png` (the ~95 masks, 900×1200). Copy into
  `fixtures/cutouts/`.
- **Cutout metadata** — the frames array in `../treatink/web/src/store/customizerSlice.jsx`
  (`url`, `category`, `theme`, `petNamePosition`, `name`, `desc/tags`). Map to §5 fields
  (`petNamePosition → pet_name_position`, `name → title/slug`).
- **Precomputed alpha geometry** — if not present in the store, generate once with a port of the
  reference alpha-analysis (Charter Appendix D.7 / api `analysis.py` semantics: `alpha_threshold=8`,
  fully-transparent bounds, center component, largest safe rectangle) over each PNG; emit §5 shape.
- **Products/variants** — the `treatink-api` seed (`../treatink-api/.../catalog` package data) or the
  store's product config; map to §2/§3 shapes (SKU on variant, `label_zone` on variant).
- **Sample photos** — a few test images (portrait/landscape/square + one low-res + one HEIC) under
  `test/golden/fixtures/` for engine goldens (`docs/06` §3).

Keep raw wire JSON under `fixtures/`; the catalog adapter normalizes to the internal model. Cite the
source path in a `fixtures/README.md`.
