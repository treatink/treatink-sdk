# 07 · Glossary

Shared vocabulary. Where the store and the Charter use different words for the same thing, both are
listed with the SDK's chosen term in **bold**.

- **Channel** — a registered storefront hostname; the unit of partner identity, branding, and
  commission. Passed to `Treatink.init({ channel })`; sent as the channel header. `GET /v1/channel`
  returns its metadata.
- **Publishable key** — `pk_test_`/`pk_live_` (Charter wrote `tk_pub_`). Browser-safe; catalog +
  assets. The only key type the browser bundle may use.
- **Secret key** — `sk_test_`/`sk_live_` (Charter wrote `tk_live_`). Server-only; orders, shipments,
  webhooks. Never in the browser.
- **Cutout / template / frame** — the same thing: a label design, a transparent PNG whose
  transparency reveals the photo beneath it. Store calls it "frame"; Charter/API call it
  "template"/"cutout". SDK public term: **template** (`tk.templates`, `templateKey`).
- **Cutout mask** — the frame PNG's own alpha channel. It *is* the mask, applied at draw time. No
  separate vector mask or precomputed geometry is used at runtime (`docs/05` §0, §9).
- **Label zone** — normalized `{x,y,width,height}` marking where the printed label sits on a
  **product mockup image**. Used for display placement only; **not** used to clamp editing in the
  store model (`docs/05` §9).
- **Canvas** — the fixed **900 × 1200** editing/print space. Editing happens here; the print
  composite is this canvas.
- **Transform** — the photo's `{ x, y, scale, rotation }` in canvas space (`docs/05` §2). Serialized
  toward the API's `image_metadata`. Semantics defined by the store code, not Appendix D.
- **Composite** — the rendered photo + cutout overlay + text. **Print composite** = the 900 × 1200
  canvas (the printed file). **Display composite** = preview for cart/thumbnail (`previewUrl`).
- **Personalization text** — the on-label text (Riley's "Pet Name"). SDK field `personalizationText`;
  on the wire it rides in the order body as `personalization.personalization_text` (`docs/08` §7).
  Per-cutout vertical placement via `pet_name_position` ∈ `default | top | upper | bottom` (offsets
  `160/130/100/320` in 1200-space; `docs/05` §7). Also a **display composite** (`previewUrl`) = the
  product mockup with the label composited into `label_zone` (`docs/05` §8.1), not the bare canvas.
- **Session** — a customization object in the *Charter* model. **Dropped from the SDK** (GP-18): the
  real backend has no sessions and is asset-based, so `tk.sessions.*` does not exist. The designer's
  save orchestrates assets directly (`docs/04` §2.2, `docs/10` §9). *(A `sessionUuid` still exists in
  the store's legacy iframe mode — see `docs/design-reference` — but the SDK does not expose it.)*
- **Asset** — the live API's uploaded file object (`POST /v1/assets`, `role` = source/rendered/…).
  Referenced by order line items (`source_asset_id`, `rendered_asset_id`).
- **Draft** — the SDK's locally persisted **reference record** for a saved personalization
  (`localStorage`, no image bytes; Charter §9).
- **Fixtures mode** — the SDK's bundled, contract-faithful backend simulation (Charter §11). Default
  in dev/CI; makes Phases 1–3 buildable offline.
- **Transport** — the single seam (`Transport` interface) between the SDK and any backend;
  `HttpTransport` (live) or `FixtureTransport` (fixtures). `docs/01` §4.
- **Low-res flag** — boolean warning when the photo is upscaled beyond ~105% of native onto the
  print canvas (Charter D.8). Warns, does not block.
- **Golden test** — a frozen reference render the ported engine must match, defining a correct port
  (`docs/06` §3).
- **Gate** — an objective pass/fail command that decides "done." The loop advances only on green.
- **The Charter** — `Treatink_SDK_Design_Brief_and_Charter_2.md`. Authoritative for scope/product;
  a *brief*, so superseded on technical math by the store code (`README.md` priority table).
