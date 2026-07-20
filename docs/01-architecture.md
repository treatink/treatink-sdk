# 01 · Architecture

How `@treatink/sdk` is structured, why, and the boundaries agents must not cross. Scope decisions
here come from the Charter (§1–§13); the engine's internal shape comes from the store code
(`docs/05-engine-reference.md`).

## 1. Where the SDK sits in the platform

The SDK is **component #2** of a five-part platform and is the engine's only supported browser
client. The dependency direction is fixed:

```
  API engine (api.treatink.com)  ← source of truth
      ▲
      │ HTTP (publishable key)          │ HTTP (secret key, server only)
      │                                  │
   @treatink/sdk  ───────────────────────┘
      ▲            (browser)   (@treatink/sdk/server)
      │
   consumers: Riley's storefront, treatink.com D2C, the Shopify app
```

The SDK owns **the personalization moment** (the designer modal + the client for publishable-key
operations). The partner owns everything else: product pages, cart, checkout, payment. Order
submission is the partner's server responsibility; the SDK only pre-wires it.

## 2. Package shape (Charter §4)

One repository, two published forms:

- **CDN bundle** — `https://sdk.treatink.com/v1/treatink.js`. A small loader (**≤ 15 KB gz**)
  exposing the **`Treatink`** global, lazy-loading the designer chunk on first open. `async`/`defer`
  safe; no `document.write`; SRI per release.
- **npm** — `@treatink/sdk`. ESM + TypeScript types. Browser entry has **no secret-key code path**.
  A separate `@treatink/sdk/server` entry (Node ≥ 18) does the one secret-key operation: order
  submission.

`/v1/` is the compatibility channel (non-breaking only); npm follows semver + changelog.

## 3. Module map

Proposed source layout (agents create files here in Phase 1; this is the target, not existing code):

```
src/
  index.ts                 # public entry: Treatink.init(); re-exports public types
  config.ts                # TreatinkConfig, defaults, key-prefix guard
  types.ts                 # public type surface (Charter §6) — the contract

  transport/
    transport.ts           # Transport interface (the seam between SDK and backend)
    http-transport.ts      # live: fetch, auth header, channel header, retry/backoff
    fixture-transport.ts   # bundled backend simulation (Charter §11) — the default in dev/CI
    errors.ts              # TreatinkError + code mapping (Charter §6.5)

  api/                     # thin typed namespaces over the transport
    products.ts            # tk.products.list/get      (catalog adapter — see §5)
    templates.ts           # tk.templates.list         (cutout-labels)
    artwork.ts             # tk.artwork.upload         (two-step asset flow; docs/04 §2.3)
    orders.ts              # tk.orders.buildPayload    (browser, no network)
    #  NB: no sessions.ts — the backend is asset-based (GP-18)

  catalog/
    adapter.ts             # normalizes catalog wire → internal model (isolates schema churn)

  cutout-engine/           # PURE. no DOM. canvas injected at edges. (docs/05)
    geometry.ts            # coordinate spaces, initial fit, clamps
    transform.ts           # {x,y,scale,(rotation)} semantics
    render.ts              # compose(photo, cutout, text) via injected canvas ctx
    text.ts                # personalization-text placement (ports renderPetName)
    export.ts              # print + display + source artifacts; low-res flag
    types.ts

  designer/                # the modal UI (light DOM, tk- prefixed) (Charter §7)
    designer.ts            # open/close, lifecycle, single-instance guard
    modal.ts               # portal root, header, focus trap, a11y
    controls/              # upload, zoom, category chips, text toggle, save
    theme.ts               # ThemeConfig → CSS variables
    copy.ts                # CopyStrings + overrides
    styles.css             # one injected stylesheet, scoped reset inside root

  drafts/
    store.ts               # localStorage reference records (Charter §9) — NO image bytes
    types.ts

  save/
    pipeline.ts            # upload-on-save orchestration (Charter §8.4)

  media/
    heic.ts                # lazy HEIC→JPEG transcode chunk (Charter §16.9)
    exif.ts                # EXIF orientation correction

server/
  index.ts                 # @treatink/sdk/server: submitOrder() (secret key, Node)
```

Test/fixtures layout is defined in `docs/06-testing-and-gates.md`.

## 4. The one architectural seam: `Transport`

Everything backend-facing goes through a single `Transport` interface with two implementations
(`HttpTransport`, `FixtureTransport`). **Nothing above the transport knows which backend is live.**
Switching `mode: 'live' | 'fixtures'` swaps the implementation and nothing else. This is what makes
the SDK **fixtures-first** (Charter §1, §11) and is why the live-API divergences in
`docs/04-api-reconciliation.md` do not block the bulk of the build.

Rules:
- API namespaces (`api/*`) call the transport; they never call `fetch` directly.
- The transport is the **only** place URLs, headers, auth, and retry live.
- Fixtures reproduce the documented wire contract exactly (IDs, statuses, error envelope) so a live
  swap needs no consumer code change.

## 5. The catalog adapter (isolate schema churn)

The catalog contract is **provisional** (Charter §16.3, Appendix B) and the live API's catalog
shape differs (`docs/04`). All catalog parsing sits behind `catalog/adapter.ts`: wire shape in,
stable internal model out. Consumers and the designer only see the internal model, so schema
changes are a one-file edit.

## 6. The cutout engine is pure (Charter §8.1)

`cutout-engine/` has **zero DOM dependencies**; canvas/OffscreenCanvas is injected at the edges.
This makes it unit-testable, golden-testable, and runnable in Node — so the platform's future
server-side print rendering can reuse the *same* module. One engine on both sides = the WYSIWYG
guarantee. **The engine's behavior is defined by the store code, not re-derived** — see
`docs/05-engine-reference.md`.

## 7. Security boundaries (Charter §10)

- `Treatink.init` validates the key prefix: only publishable keys allowed; a secret key throws
  `key_scope_violation` immediately. The browser bundle contains **no** code that attaches a secret
  key to a request — enforced by construction and by a build-time check (gate in `docs/06`).
- Keys go only in `Authorization: Bearer`, never in URLs, never logged.
- No third-party requests of any kind.
- `@treatink/sdk/server` is the *only* place a secret key is used, and it is a separate entry point
  never imported by the browser build.

## 8. Rendering model (light DOM — Charter §16.1 / §7.3)

MVP uses **light DOM with `tk-`-prefixed classes** and one injected stylesheet with a scoped reset,
following the store's `ti-*`/`treatink.css` pattern. Host customization = init `theme` params
(→ CSS variables) **plus** ordinary host CSS on the documented `tk-` classes. Shadow DOM isolation
is deferred (Charter §2, §17) — do not build it in MVP.

## 9. Compatibility targets (Charter §13)

Evergreen Chrome/Edge/Firefox (last 2 majors), Safari ≥ 16 incl. iOS. No IE. Main-thread canvas at
900×1200 is acceptable. Cap in-browser composite dimensions on memory-constrained iOS Safari rather
than crashing.
