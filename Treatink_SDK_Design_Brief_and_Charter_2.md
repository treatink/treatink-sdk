# Treatink SDK — Design Brief & Engineering Charter

**Status:** Draft v2 — MVP-scoped; owner decisions of 2026-07-20 recorded in §16 · **Date:** 2026-07-20 · **Owner:** Mark (Bitmotive)
**Audience:** Treatink engineering team (SDK implementation)
**Companion documents:** Treatink Integration Platform API docs (api-docs.treatink.com), Platform API Notes, 2025 Brand Book, Project Context & Architecture, and the Shopify App Prototype codebase, whose cutout math this charter specifies exactly in Appendix D

**Scope note:** v2 deliberately narrows v1. The bar for MVP inclusion is a single question: *does the Riley's personalizer, as it runs today, need it?* Everything that fails that test moved to Deferred (§2) or the open-items list (§17).

---

## 1. Purpose and place in the platform

Treatink is being rebuilt as an e-commerce platform — "Printful for the pet space" — composed of five components. The SDK is component #2, and its scope only makes sense in relation to the other four:

1. **API-Driven Sales Channel Engine** (`api.treatink.com/v1`) — the core of the platform: a REST API managing customization **sessions**, artwork rendering and storage, and order fulfillment, with hostname-scoped **channels** that map every storefront to its partner record, label branding, and commission rates. Everything else in this list is a client of the engine.
2. **The SDK** — the subject of this document, and the engine's browser-side expression: a JavaScript/TypeScript library that third-party websites embed to add Treatink product personalization to their own storefronts. It replaces the current iframe-based prototype (live today on the [Riley's Pets personalized biscuits page](https://rileyspets.com/collections/best-sellers/products/personalized-rileys-peanut-butter-molasses-baked-biscuits-small-bone-12oz)) with a native, embedded modal experience, and it gives partner developers a safe, ergonomic client for the public portions of the Treatink API. Order submission after payment remains the sales channel's responsibility, but the SDK pre-wires those endpoints so discharging that responsibility takes a few lines of code (§5, §6.4).
3. **Shopify App** — lets merchants personalize and sell Treatink products on their own Shopify store with no custom integration work. It is built *on* the SDK — the app's storefront embed ships this same bundle — which is why the SDK core carries zero Shopify dependencies. Its predecessor, the **Shopify App Prototype**, is the reference implementation whose cutout math this charter specifies in Appendix D.
4. **Partner Portal** (`partners.treatink.com`) — where partners view account information, register channel hostnames, and generate or roll API keys (rotation immediately revokes prior keys). The portal provisions the two values every SDK integration starts with: the publishable key and the registered channel hostname passed to `Treatink.init()` (§6.1).
5. **Branded D2C storefront** (`treatink.com`) — Treatink's own consumer sales channel. Architecturally it is channel #1 on the same engine and will run this same SDK; the inline designer on the current homepage becomes a thin post-MVP variant of the same component (§2), making treatink.com the SDK's first-party dogfooding surface once shipped.

The dependency direction matters: the engine is the source of truth; the SDK is its only supported browser client; the Shopify app and the D2C storefront are the SDK's first two consumers; and the portal provisions credentials and channels for all of them. A direct integration partner like Riley's and Treatink's own storefront run through the same code path — so every designer improvement lands everywhere at once, and any partner-facing bug is a first-party bug too.

The SDK exists to provide integrating sites with exactly two things:

1. **A drop-in personalizer** — a designer UI that automatically pulls Treatink label cutouts and knows about Treatink products via the API, rendered as an embedded modal (not an iframe) so host sites can customize its look and feel.
2. **A convenience API client** — typed functions that make it easy for client-side code to call the Treatink API for any publishable-key operation. It must not permit secret-key operations from the browser.

Everything else — product listing pages, carts, checkout, payment — remains the integrating site's responsibility. The SDK owns the personalization moment; the partner owns the store.

Because the production API is not yet queryable, the SDK is built **fixtures-first**: every backend endpoint is mimicked by bundled fixtures that match the documented wire format exactly, so switching to the live API is a configuration change, not a rewrite.

## 2. MVP scope

The MVP north star: **rebuild the personalizer that runs today on the [Riley's Pets product page](https://rileyspets.com/collections/best-sellers/products/personalized-rileys-peanut-butter-molasses-baked-biscuits-small-bone-12oz) — same features, same flow — as a native embedded modal on the platform architecture, with no iframe.** Anything the Riley's designer doesn't do, the MVP doesn't do.

**In scope (MVP)**

- The modal designer with the screenshot's feature set: photo upload (drag-and-drop plus file picker; HEIC accepted and transcoded — §16.9), background/cutout browsing by category with a Browse All view, an "Include Pet Name on Label"-style personalization-text toggle and input with basic on-label rendering, drag-to-position with button/slider zoom, the low-resolution warning, and a Save Customization action.
- **Upload-on-save** (§16.4/§16.6): saving a customization creates a session and uploads the source photo and print composite immediately; `localStorage` keeps only small reference records — never image data.
- The cutout engine, ported exactly per Appendix D and verified by golden tests.
- The publishable-key API client: products, templates, sessions (create/get), artwork upload — plus `orders.buildPayload()` and the minimal server-side submit helper.
- Fixtures mode covering all of the above.
- Modal theming via init color parameters; deeper restyling via ordinary host CSS on the SDK's namespaced markup (§7.3).

**Deferred beyond MVP**

- The inline `mount()` render target (the treatink.com homepage variant).
- Subject selection ("Choose Your Pet") and template facets — deprecated along with `animal_type` (§12); the Riley's designer has no such step.
- `sessions.update` / in-place re-editing — re-saving a draft creates a fresh session instead.
- Shadow DOM isolation and the `::part()`/custom-property theming system — the hardening step for broad distribution beyond known pilot channels.
- Touch pinch-zoom and keyboard nudging (MVP matches the prototype: drag plus zoom buttons/slider).
- Locale/i18n beyond the copy-override map; framework wrappers; multiple concurrent modals; worker/OffscreenCanvas offloading; extended `print_spec` PPI thresholds (the reference 1.05× upscale warning stays); telemetry.

**Non-goals (unchanged from v1)**

- No product-list or catalog UI — the SDK returns catalog data; displaying it is entirely the integrating site's choice.
- No cart, checkout, payment, tax, or shipping logic.
- No secret-key (`tk_live_…`) operations in browser code, ever.
- No iframe rendering mode, including as a fallback.

## 3. Design principles

**The partner owns the storefront; the SDK owns the designer moment.** The SDK never injects UI the partner didn't ask for.

**Stripe-shaped developer experience.** Sessions, scoped keys, typed errors with stable codes, idempotent operations, one script tag to start.

**Deterministic rendering.** Same inputs (photo, template, transform, zone) → same composite, on any device and eventually on the server. The engine is a pure module with no DOM dependencies (§8.1); this is what makes "what you saved is what gets printed" a guarantee.

**Photos are sensitive.** They travel only to Treatink infrastructure over TLS — at save time, now that upload happens on save — are never logged or sent to third parties, and locally stored drafts hold references, not images (§9).

## 4. Packaging and distribution

Two forms from one repository:

- **CDN bundle** at `https://sdk.treatink.com/v1/treatink.js` — the URL already printed in the public API docs. A small loader (≤ 15 KB gzipped) exposing the **`Treatink`** global (casing per §16.8 — the docs' current `TreatInk.init` example must be updated), lazy-loading the designer chunk on first open. Safe to load `async`/`defer`; no `document.write`; SRI hashes published per release.
- **npm package** `@treatink/sdk` — ESM with TypeScript types; browser entry (no secret-key code paths exist in it) plus `@treatink/sdk/server`, a minimal Node ≥ 18 helper for the one secret-key operation: order submission (§6.4).

`/v1/` is the compatibility channel (non-breaking changes only); npm follows semver with a changelog.

**For the docs team:** the published API docs describe the SDK as rendering "in a secure iframe" and use `TreatInk` casing — both must be updated before MVP promotion (§17).

## 5. Integration lifecycle

The five-step flow, mapped to the platform's documented session lifecycle (Mount → Design → Capture → Confirm → Fulfil):

1. **Catalog.** The SDK fetches available products (`tk.products.list()`). Displaying them — or hard-coding one SKU — is the integrating site's call.
2. **Open.** The shopper chooses to personalize; the site opens the modal for a specific SKU: `tk.designer.open({ sku })`. (Mount + Design.)
3. **Customize.** Appearance is controlled by init theme parameters, host CSS, and copy overrides (§7.3). The shopper uploads a photo, positions it in the cutout, picks a background, optionally adds personalization text.
4. **Save.** The SDK creates a session, uploads the source photo and the rendered print composite, writes a small reference draft to `localStorage` (§9), and fires `onComplete` with the session ID and preview — which the site uses to add the item to its cart, typically stashing the `sessionId` in line-item properties. (Capture.)
5. **Order.** After payment is validated, the sales channel sends the order to Treatink (Confirm): `tk.orders.buildPayload()` assembles the exact documented `POST /v1/orders` body in the browser, and `@treatink/sdk/server` submits it with the secret key from the partner's backend. Fulfilment proceeds on the Treatink side.

```html
<script src="https://sdk.treatink.com/v1/treatink.js" async></script>
```

```js
const tk = Treatink.init({
  apiKey: 'tk_pub_9f2c…',
  channel: 'rileyspets.com',
  mode: 'fixtures',                    // until the API is live
  theme: { primary: '#8EA0F6', accent: '#EA8D00', headerBackground: '#F26B1D' },
  copy:  { personalizationTextLabel: 'Pet Name' }
});

document.querySelector('#personalize').addEventListener('click', () => {
  tk.designer.open({
    sku: 'TIN-DOG-TREATS-12',
    onComplete(r) { /* add to cart with r.sessionId / r.previewUrl */ },
    onError(e)    { /* surface e.code / e.message */ }
  });
});
```

## 6. Public API surface

Names below are the contract; TypeScript definitions ship with the package and are the source of truth.

### 6.1 Initialization

```ts
interface TreatinkConfig {
  apiKey: string;                 // must be tk_pub_…; tk_live_… throws immediately (§10.1)
  channel: string;                // registered storefront hostname; sent as the channel header
  mode?: 'live' | 'fixtures';     // default 'live'; 'fixtures' uses the bundled backend simulation (§11)
  apiBaseUrl?: string;            // override for staging environments
  theme?: ThemeConfig;            // §7.3
  copy?: Partial<CopyStrings>;    // every designer string is overridable — channel voice lives here
  debug?: boolean;
}

const tk = Treatink.init(config);
```

### 6.2 Namespaces (browser)

- `tk.products.list()` / `tk.products.get(sku)` and `tk.templates.list({ sku })` — catalog access. The endpoint is a known gap in the published API docs; the fixture schema in Appendix B is the working proposal and is expected to change before publication (§16.3), so catalog parsing sits behind an internal adapter.
- `tk.sessions.create({ sku, personalizationText?, metadata? })` / `tk.sessions.get(id)` — typed wrappers over the documented endpoints, sending `personalization_text` natively (§12). `PATCH` is not wrapped in MVP.
- `tk.artwork.upload({ sessionId, slot, file })` — multipart per the docs (`original_image | front_label | back_label`, PNG/JPEG ≤ 25 MB), publishable-key scope confirmed (§16.5). Client-side validation before any network call.
- `tk.designer.open(options)` / `tk.designer.close()` — the modal personalizer (§7).
- `tk.drafts.list()` / `get(id)` / `delete(id)` / `clear()` — the reference-record persistence layer (§9). `tk.designer.open({ draftId })` re-opens a saved draft.
- `tk.orders.buildPayload({ externalOrderId, customer, lines })` — assembles the documented order body from drafts/sessions. No network, nothing secret.
- `tk.on(event, handler)` — `'designer:open' | 'designer:close' | 'draft:saved' | 'error'`.

### 6.3 Designer options and result

```ts
interface DesignerOptions {
  sku: string;                          // required
  draftId?: string;                     // re-open a saved draft (re-saving creates a new session)
  personalizationText?: string;         // prefill
  templateKey?: string;                 // preselect a cutout
  onComplete?(result: DesignerResult): void;
  onError?(error: TreatinkError): void;
  onClose?(): void;
}

interface DesignerResult {
  draftId: string;                      // UUID — also the idempotency token
  sessionId: string;
  sku: string;
  templateKey: string;
  personalizationText?: string | null;
  previewUrl: string;                   // display composite for cart/thumbnail use
  artwork: { originalUrl: string; printUrl: string };   // uploaded references (§8.4)
  transform: { x: number; y: number; scale: number };   // reference semantics — Appendix D.3
  labelZone: { x: number; y: number; width: number; height: number };  // context the transform needs (§8.3)
  lowRes: boolean;                      // Appendix D.8
}
```

### 6.4 Server entry point

```ts
import { submitOrder } from '@treatink/sdk/server';

await submitOrder(payload /* from tk.orders.buildPayload() or hand-built */, {
  secretKey: process.env.TREATINK_SECRET_KEY,   // tk_live_…
  channel: 'rileyspets.com'
});
```

Deliberately tiny: auth headers, channel header, JSON encoding, typed errors, and the documented idempotency behavior (re-posting an `external_order_id` returns the original order — safe to retry). Partners may call the REST endpoint directly instead and lose nothing.

### 6.5 Errors

```ts
class TreatinkError extends Error {
  code: string;    // documented API codes (invalid_request, invalid_api_key, channel_not_registered,
                   // session_not_found, session_locked, session_incomplete) plus SDK-local:
                   // key_scope_violation, unsupported_file_type, upload_failed
  status?: number;
}
```

Fixture mode produces identical error objects on demand (§11).

## 7. The designer (MVP)

### 7.1 The modal

One render target: a full overlay portal-rendered at `document.body`, with the branded header bar ("Personalize Your Product" — copy-overridable), a close control, and a scroll-locked page behind it. On mobile it becomes a full-screen sheet and the two-column layout (preview left, controls right) stacks vertically. Opening a second modal while one is live is rejected.

### 7.2 Feature set — Riley's designer parity

The MVP designer reproduces the personalizer on the [Riley's Pets product page](https://rileyspets.com/collections/best-sellers/products/personalized-rileys-peanut-butter-molasses-baked-biscuits-small-bone-12oz):

- **Photo input:** drag-and-drop zone plus "Or Select Image" picker. Client-side validation (≤ 25 MB per the API contract), EXIF orientation correction, and HEIC/HEIF accepted with client-side transcode to JPEG (§16.9 — the decoder loads as a lazy chunk only when a HEIC file appears).
- **Positioning:** drag to pan, buttons/slider to zoom, constrained exactly by the reference clamp and zoom math (Appendix D.5–D.6). The low-resolution warning fires per D.8; it warns, it does not block.
- **Background/cutout browser:** category chips (Standard, Holidays, Birthdays, Occasions — driven by template metadata, not hard-coded), a paged thumbnail row, and a Browse All grid.
- **Personalization text:** an opt-in toggle plus input ("Include Pet Name on Label" in Riley's channel copy via `copy.personalizationTextLabel`), template-defined length limit, rendered onto the label using the template's `personalization_text_position` hint — one style per template, no font controls (Appendix D.9).
- **Save:** the primary CTA runs the upload-on-save pipeline (§8.4) with visible in-flight state, a clear failure state with retry (`upload_failed`), and success closing the modal via `onComplete`. Channel branding (e.g., the Treatink watermark) comes from channel/theme configuration, not a hard-coded asset.

### 7.3 Rendering, customization, and accessibility

**Decision (§16.1): light DOM, namespaced markup — the most straightforward build now.** The designer renders into a body-appended root using `tk-`-prefixed classes with one injected stylesheet and a scoped reset inside the root, directly following the prototype's `ti-*`/`treatink.css` pattern. Host customization is therefore two plain layers:

```ts
interface ThemeConfig {
  primary?: string;            // default #8EA0F6 (brand periwinkle)
  accent?: string;             // default #EA8D00 (brand orange)
  headerBackground?: string;   // Riley's uses its own orange
  headerText?: string;
  surface?: string;
  borderRadius?: string;
  fontFamily?: string;         // brand stack (Montserrat/Mitr) with system fallback
  overlayColor?: string;
  zIndex?: number;             // default 2147483000
  logo?: string | false;
}
```

plus ordinary host CSS targeting the documented `tk-` classes — no special mechanism required, which directly satisfies "customizable via instantiation parameters or by CSS rules on the hosting site."

The accepted tradeoff: aggressive host themes *can* collide with the designer's styles. That risk is acceptable while distribution is the known pilot channels (Riley's, then treatink.com); Shadow DOM isolation is the planned post-MVP hardening step before broad third-party rollout (§2, §17).

Accessibility essentials ship in MVP: `role="dialog"` with `aria-modal`, focus trap and focus restoration, Escape to close, all controls tabbable and labeled (zoom buttons included), image alt text, and the low-res warning announced to assistive tech.

## 8. The cutout engine

The SDK's technical heart: the math determining where an uploaded image is visible through a label cutout, how it may be moved and scaled, and how composites are produced.

**The reference implementation lives in the Shopify App Prototype codebase — chiefly `app/components/LabelEditor.tsx` (transform, clamping, zoom, low-resolution detection, export) and `seed/scripts/snapshot.mjs` (alpha-opening analysis). Port it — do not rewrite it from intuition.** Its behavior defines correctness. Appendix D specifies the math exactly as the reference implements it; the port must be validated against golden outputs generated from the reference code (§14).

### 8.1 Structure

A pure TypeScript `cutout-engine` module with zero DOM dependencies; canvas/OffscreenCanvas is injected at the edges. This makes it unit-testable and runnable in Node — so the platform's server-side print rendering can later use the *same* module. One engine on both sides is the WYSIWYG guarantee.

### 8.2 Geometry model (as implemented by the reference)

Two rectangles and one mask, fully specified in Appendix D:

- **The product label zone** — a rectangle stored as normalized fractions `{x, y, width, height}` of the product mockup image, marking where the printed label sits on the product. All editing happens in the mockup's natural-pixel coordinate space.
- **The cutout canvas** — a fixed **900 × 1200** print space. Every cutout is a single transparent PNG at exactly this size, drawn *over* the photo. There is no separate underlay layer and no vector mask: **the PNG's alpha channel is the authoritative cutout mask** — the photo is visible wherever the cutout is transparent.
- **Derived opening geometry** — precomputed per cutout (Appendix D.7): the bounds of fully transparent pixels, the connected transparent component at the canvas center, and the largest fully-transparent axis-aligned rectangle (the conservative photo-safe region). These summarize irregular masks for layout decisions; they never replace the alpha channel for rendering.

Engine responsibilities: resolve the zone to pixels; compute the initial cover fit; clamp pan and zoom (the reference enforces a **minimum 15% overlap per axis**, not full window coverage — the shopper may leave parts of the zone photo-free); zoom about the zone center; detect low resolution; and export print, display, and source artifacts. Rotation is not supported — transforms are translation plus uniform scale only.

### 8.3 Transform contract — decided

The user's positioning serializes as `{ x, y, scale }` — the shape the API documents as `image_metadata`. The reference implementation defines the semantics (Appendix D.3): **`x`/`y` are the photo's top-left corner in mockup natural-pixel space, and `scale` is an absolute multiplier on the photo's natural pixel dimensions.**

This transform is not self-contained — it is only interpretable together with the label zone, the mockup's natural dimensions, and the photo's natural dimensions. **Per §16.2, MVP resolves this the way the reference does: persist the context alongside the transform** — drafts, sessions, and the `DesignerResult` all carry `labelZone` (and image dimensions where needed) next to `transform`, and the API docs must state that `image_metadata` is interpreted in that context. No normalization layer; zero deviation from the golden-tested math. A self-contained zone-relative wire form remains a possible later refinement, not an MVP concern.

For resolution safety, the reference computes one boolean at export: **low-res** if mapping the photo to the 900 × 1200 print canvas upscales it beyond 105% of its native pixels (Appendix D.8). That is the MVP's only resolution check.

### 8.4 Export and upload-on-save pipeline

Saving runs this sequence (per §16.4/§16.6 — upload at design time, references only in local storage):

1. Render the reference's three artifacts (Appendix D.8): the **print composite** (900 × 1200 — the file that gets printed), the **display composite** (mockup preview for cart imagery), and the untouched **source**.
2. Ensure a session exists: `POST /v1/sessions` with the SKU, `personalization_text`, and the draft's idempotency key in `metadata`.
3. Upload the source to the `original_image` slot and the print composite to the `front_label` slot (`POST /v1/artwork`, publishable key — confirmed, §16.5).
4. Read back the session (`GET /v1/sessions/{id}`) for its canonical `preview_url` and artwork URLs; in fixture mode these are locally generated object URLs.
5. Write the reference draft to `localStorage` (§9) and fire `onComplete` with the `DesignerResult`.

Every step has explicit failure handling surfaced in the Save UX (§7.2); nothing is persisted for a design abandoned before a successful save. Because rendering is deterministic, both composites are always reproducible from `(source, template, transform, zone)` — which also lets the server re-render at print time from `image_metadata` plus the stored context. Uploading at design time means abandoned carts leave orphaned sessions and artwork server-side; a retention/cleanup policy is an API-side requirement (§17). iOS Safari canvas memory limits still apply: cap in-browser composite dimensions on constrained devices rather than crashing (900 × 1200 output is comfortably small).

## 9. Persistence: `localStorage`, references only

Per §16.4/§16.6, **no image data is ever stored client-side** — not in `localStorage`, not in IndexedDB. A draft is a small JSON reference record, written only after a successful save:

```
treatink:v1:<channel>:index            → { version: 1, draftIds: [...] }
treatink:v1:<channel>:draft:<draftId>  → DraftRecord
```

```ts
interface DraftRecord {
  draftId: string;               // UUID v4 — the idempotency token, carried in session metadata
  createdAt: string; updatedAt: string;
  channel: string;
  product: { sku: string };                                   // product reference
  cutout:  { templateKey: string };                           // cutout reference
  personalizationText?: string | null;
  transform: { x: number; y: number; scale: number };          // Appendix D.3
  labelZone: { x: number; y: number; width: number; height: number };   // context (§8.3)
  sessionId: string;
  artwork: {                     // remote references — the composite that will be printed lives
    originalUrl: string;         //   server-side; localStorage points at it
    printUrl: string;
    previewUrl: string;
  };
  status: 'completed' | 'ordered';
}
```

This satisfies the original storage requirement — original photo, cutout reference, product reference, idempotency token, and the print composite — with the two image items held as remote references per §16.4. Records are a few hundred bytes, so quota engineering collapses to basics: a bounded draft count (default 5, LRU eviction), a TTL (default 30 days), a versioned namespace with migrate-or-discard, and a graceful in-memory fallback if `localStorage` is unavailable or full.

**Re-editing:** `tk.designer.open({ draftId })` reloads the original from `originalUrl` (CDN images must be CORS-readable for canvas use; the prototype already loads with `crossOrigin="anonymous"`), restores the transform, and — since `sessions.update` is deferred — a re-save creates a fresh session and new draft state.

**Fixture-mode caveat:** fixture "uploads" produce session-scoped object URLs, so draft image references do not survive a page reload in fixture mode. Acceptable for a development surface; live mode has no such limitation.

**Privacy:** photos now leave the device at save time, before purchase — integration docs must say so, partners must disclose it, and `tk.drafts.clear()` removes local references on shared devices.

## 10. API client, security, and privacy

### 10.1 Key discipline

`Treatink.init` validates the key prefix: anything other than `tk_pub_…` — most importantly `tk_live_…` — throws `key_scope_violation` immediately. The browser bundle contains no code path that attaches a secret key to any request. Keys are never logged, never placed in URLs, and sent only via `Authorization: Bearer`. Key rotation in the portal immediately revokes prior keys; the client surfaces the resulting `invalid_api_key` cleanly rather than retrying.

### 10.2 Transport behavior

The client sends the channel hostname header automatically (documented as `X-TreatInk-Channel`; the canonical casing should be updated to match §16.8 — HTTP headers are case-insensitive on the wire, so this is a docs alignment, not a breaking change). It speaks the documented JSON error envelope, mapping every code to `TreatinkError`. Idempotent GETs retry with exponential backoff and jitter; order submission is safely retryable via `external_order_id`; artwork uploads surface `upload_failed` to the Save UX rather than retrying blindly. No third-party requests of any kind — no analytics, no external fonts, no trackers.

**For the API team:** browser calls require CORS. The natural policy falls out of the channels model — allow origins matching registered channel hostnames, with a mismatched `Origin` producing the existing `403 channel_not_registered`. This turns channel registration into browser-enforced security and should be documented (§17).

### 10.3 Partner guidance

Integration docs ship a recommended CSP fragment (`script-src sdk.treatink.com; connect-src api.treatink.com; img-src cdn.treatink.com blob:`), SRI usage, and the §9 privacy disclosure note.

## 11. Fixtures mode

The API cannot be queried today, so fixtures mimic every backend endpoint — and remain a first-class mode afterward for partner development and CI.

- A transport interface with two implementations: `HttpTransport` and `FixtureTransport`. Mode selection is the `mode` flag; nothing else in the SDK knows the difference.
- Fixtures reproduce the documented wire contracts exactly: session objects and statuses (`open → completed → ordered`), deterministic `sess_fx_…` IDs, artwork slots, the order response, and the full error envelope. Switching to the live API must require no code changes in an integration.
- Controllable failures for testing: configurable latency and `tk.fixtures.failNext('sessions.create', { status: 422, code: 'session_incomplete' })`.
- Uploads never touch the network; "uploaded" artwork becomes object URLs (see the §9 reload caveat).
- The fixture catalog implements Appendix B — **explicitly provisional per §16.3** — seeded from the prototype's real data (14 products, 95 cutouts, including the seed README's edge cases: products without zones, slug collisions, the storefront-only Riley's product). Catalog parsing stays behind an internal adapter so schema churn before publication is cheap.

## 12. Vocabulary and naming — effective now

Per §16.7 and §16.8, the renames land in API 1.0 immediately rather than through an SDK mapping layer:

| Legacy | Now |
|---|---|
| `pet_name` | `personalization_text` — the SDK sends it natively; "Pet Name" is Riley's channel copy via `copy.personalizationTextLabel` |
| `animal_type` (`dog\|cat`) | **Deprecated.** Not sent by the SDK, not surfaced in the designer. Subject/facet selection is deferred (§2); the field's eventual successor is a general template-facet mechanism, decided post-MVP |
| `petNamePosition` (seed) | `personalization_text_position` on templates (`default \| top \| upper \| bottom`) — the MVP text-placement hint |
| "TreatInk" | **"Treatink"** — the one casing, everywhere: prose, JS global (`Treatink.init`), error copy, docs. Wire artifacts documented with the old casing (`X-TreatInk-Channel`, docs prose) get aligned in the docs update (§17) |

Products carry `vertical` and `product_type` so the same surface extends to merch later; nothing in the SDK's public names is pet-specific.

## 13. Compatibility and budgets

Evergreen Chrome/Edge/Firefox (last two majors), Safari ≥ 16 including iOS; no IE. Main-thread canvas work is acceptable at 900 × 1200 output. Budgets, enforced in CI: loader ≤ 15 KB gz; designer chunk ≤ 150 KB gz (template imagery loads lazily from CDN/fixtures); the HEIC decoder is its own lazy chunk, loaded only on first HEIC ingest.

## 14. Testing and acceptance

- **Cutout engine:** unit tests plus **golden-image tests** — outputs generated by the Shopify App Prototype's reference implementation across a matrix of images × templates × transforms, committed as fixtures; the ported engine must match within strict pixel tolerance. This is the definition of a correct port.
- **Integration:** a Playwright fixture-mode suite covering the full happy path (catalog → open → upload incl. one HEIC → position → save with simulated upload success and failure → buildPayload → server submit) plus draft re-open.
- **Accessibility:** automated axe checks plus a manual keyboard pass against §7.3.

**Definition of done (MVP):** a developer with no prior context integrates designer-through-order in fixture mode in under a day using only the public docs; the [Riley's designer](https://rileyspets.com/collections/best-sellers/products/personalized-rileys-peanut-butter-molasses-baked-biscuits-small-bone-12oz) is fully reproduced as a native modal with no iframe; golden tests pass; no secret key can transit the browser bundle by construction; budgets hold; the bundle is live at `sdk.treatink.com/v1/treatink.js`.

## 15. Milestones (sequence, not dates)

1. **M1 — Core.** Package skeleton, init and key guard, transport layer with fixtures, cutout engine ported with golden tests passing.
2. **M2 — Designer.** The modal at Riley's parity (§7.2), light-DOM styling, accessibility essentials.
3. **M3 — Save path.** Upload-on-save pipeline with failure UX, reference drafts and re-open, `orders.buildPayload`, server submit helper.
4. **M4 — Live wiring and pilot.** `HttpTransport` against staging behind the mode flag; CORS verified; deploy on rileyspets.com replacing the iframe; publish the bundle at the documented URL; update api-docs; tag MVP.

## 16. Decision record — 2026-07-20 (owner: Mark)

1. **DOM isolation:** most straightforward wins — light DOM with namespaced classes for MVP (§7.3); Shadow DOM deferred to the broad-distribution hardening pass.
2. **`image_metadata` wire form:** engineering judgment — keep reference semantics and persist the interpreting context (`labelZone` + dimensions) alongside, exactly as the prototype does (§8.3). No normalization layer.
3. **Catalog contract:** treat Appendix B as provisional; it will change before publication. Fixtures implement it behind an adapter (§11).
4. **Upload timing:** upload at design time. `localStorage` is too small for image data; it stores references to the remote images instead (§8.4, §9).
5. **Artwork endpoint key scope:** confirmed — `POST /v1/artwork` accepts the publishable key (§6.2).
6. **Blob storage:** no blobs stored client-side anywhere; send them to the server, keep reference data locally (§9).
7. **Wire renames:** effective now — `personalization_text` is native; `animal_type` is deprecated (§12).
8. **Casing:** "Treatink" (§12); JS global `Treatink`, docs to be aligned.
9. **HEIC:** accept and transcode client-side, via a lazy-loaded decoder chunk (§7.2, §13).

## 17. Remaining open items

For the API/platform team: a retention and cleanup policy for orphaned sessions and artwork created by abandoned designs (a direct consequence of upload-on-save); the per-channel CORS policy (§10.2); the api-docs update pass (modal architecture replacing iframe language, `Treatink` casing and global, `personalization_text`, `animal_type` deprecation, upload-at-design flow, `image_metadata` context); and finalizing the catalog contract that Appendix B provisionally proposes. For the SDK, post-MVP in rough order: Shadow DOM isolation, the inline `mount()` target for treatink.com, in-place re-editing via `sessions.update`, template facets as `animal_type`'s successor, and pinch/keyboard input refinements.

## Appendix A — Documented endpoint coverage

| API operation (documented) | Key scope | SDK surface (MVP) |
|---|---|---|
| `POST /v1/sessions` | publishable | `tk.sessions.create` / save pipeline |
| `GET /v1/sessions/{id}` | publishable | `tk.sessions.get` / save pipeline |
| `PATCH /v1/sessions/{id}` | publishable | not wrapped in MVP — re-saving creates a new session (§2) |
| `POST /v1/artwork` | publishable (confirmed — §16.5) | `tk.artwork.upload` / save pipeline |
| `POST /v1/orders` | **secret** | `@treatink/sdk/server` `submitOrder` + browser-side `tk.orders.buildPayload` (no network) |
| `GET /v1/products`, `GET /v1/templates` *(proposed — not yet in docs)* | publishable | `tk.products.*`, `tk.templates.list` |

## Appendix B — Proposed catalog contract (PROVISIONAL)

**Expected to change before publication (§16.3).** Shaped from the prototype's seed snapshot (14 products, 95 cutouts) with §12 naming applied; implemented by fixtures behind an internal adapter.

```jsonc
// GET /v1/products
{
  "data": [
    {
      "id": 1,
      "sku": "SSGTTBC",
      "title": "Training Treats for Dogs (6oz)",
      "vertical": "pet",
      "category": "treats",                    // seed taxonomy today: treats | health
      "product_type": "treats",                // treats | biscuits | dental_treats | soft_treats | …
      "price_cents": 999,
      "status": "published",
      "images": {
        "catalog_image_url": "https://cdn.treatink.com/p/…",   // product mockup (1000×1000 today);
        "regulatory_label_url": "…"                             // label_zone is relative to this image.
      },                                                        // regulatory label ≠ personalization surface
      "label_zone": { "x": 0.321, "y": 0.316, "width": 0.358, "height": 0.478 },  // normalized (§8.2, D.2)
      "print_spec": { "canvas_px": [900, 1200], "max_upscale": 1.05 }
    }
  ]
}
```

```jsonc
// GET /v1/templates?sku=SSGTTBC   (server filters by the product's zone aspect — D.2)
{
  "data": [
    {
      "slug": "standard-frame-5",              // filename-derived slug is the unique key;
      "title": "Classic Frame",                // legacy source_name preserved as a non-unique alias
      "category": "standard",                  // standard | holidays | birthdays | occasions
      "theme": "light",                        // light | dark
      "personalization_text_position": "bottom",  // default | top | upper | bottom (§12)
      "tags": ["yellow", "hearts"],
      "canvas": { "width": 900, "height": 1200 },
      "asset": { "cutout_url": "https://cdn.treatink.com/a/….png", "sha256": "…" },
      "opening": {                             // derived alpha geometry (D.7) — summaries only;
        "alpha_threshold": 8,                  // the PNG alpha channel remains authoritative
        "fully_transparent_bounds":           { "pixels": { "x": 127, "y": 306, "width": 649, "height": 667 },
                                                "normalized": { "x": 0.141111, "y": 0.255, "width": 0.721111, "height": 0.555833 } },
        "center_transparent_component":       { "pixels": { … }, "normalized": { … }, "touches_canvas_edge": false },
        "largest_safe_transparent_rectangle": { "pixels": { … }, "normalized": { … } }
      }
    }
  ]
}
```

Notes: template `category` drives the designer's tab bar; `opening` ships precomputed so the SDK never decodes alpha channels at runtime for layout decisions. Facet/subject fields are intentionally absent pending `animal_type`'s post-MVP successor (§12). At least one fixture product should carry `vertical: "merch"` to keep the neutral pathway honest, and fixtures include the seed README's edge cases (products without zones, slug collisions, the storefront-only Riley's product).

## Appendix C — Glossary

**Channel** — a registered storefront hostname; the unit of partner identity, branding, and commission in the platform. **Draft** — the SDK's locally persisted reference record for a saved personalization. **Session** — the API's server-side customization object (`sess_…`), created at save time in MVP. **Template / cutout** — a label design defining where and how a photo and text appear. **Composite** — the rendered result of photo + cutout overlay + text; produced in print (900 × 1200) and display (mockup) variants (Appendix D.8). **Transform** — the `{x, y, scale}` positioning of the photo, serialized to the API's `image_metadata`; semantics defined by the reference implementation (Appendix D.3). **Label zone** — the normalized rectangle on the product mockup where the printed label sits. **Opening** — a cutout's transparent region, authoritatively defined by its PNG alpha channel and summarized by derived rectangles (Appendix D.7). **Fixture mode** — the SDK's bundled, contract-faithful simulation of the backend.

## Appendix D — Cutout math: reference implementation specification

Extracted from the Shopify App Prototype (`app/components/LabelEditor.tsx`, `seed/scripts/snapshot.mjs`, and the seed data model documented in `seed/README.md`). This appendix is the porting contract: the SDK's cutout engine must reproduce these behaviors exactly, verified by the golden tests in §14. Deviations are listed explicitly in D.9.

### D.1 Entities and coordinate spaces

Let the **mockup** be the product catalog image with natural pixel size `Wm × Hm` (1000 × 1000 for every current product). Let the **photo** have natural size `Wp × Hp`. Let the **label zone** be normalized fractions `Z = {x, y, width, height}` of the mockup. All interactive editing happens in **mockup natural-pixel space**; the on-screen canvas is a uniform scaling of it (`s_view = displayWidth / Wm`), and pointer deltas divide by `s_view` before being applied.

Zone in pixels:

```
z.x = Z.x · Wm        z.w = Z.width  · Wm
z.y = Z.y · Hm        z.h = Z.height · Hm
```

The **cutout canvas** is a fixed 900 × 1200 print space. Every cutout is one transparent PNG at exactly 900 × 1200, placed at (0, 0), covering the whole canvas; its alpha channel is the authoritative mask. The zone rectangle on the mockup and the 900 × 1200 canvas are linked only at export time (D.8).

### D.2 Zone → cutout aspect filtering

Cutouts are fetched filtered by the zone's aspect ratio, computed from the **normalized** values and truncated to four decimals:

```
aspect = Z.width / Z.height        // e.g. 0.358 / 0.478 → "0.7490"
GET /frames?channel=shopify&aspect=0.7490
```

Normalized ratio equals pixel ratio only because current mockups are square — an invariant the data pipeline relies on. **SDK guardrail (addition):** at catalog load, warn to the console if the mockup is non-square or the zone's pixel aspect deviates beyond tolerance from 3:4 (900:1200), since export maps zone → print canvas with independent axis scales (D.8) and a mismatched zone silently distorts the photo. (The seed data also records a legacy storefront placement formula — `overlayWidth = 0.36 · imageWidth`, centered horizontally, `y = (H − h)/1.65` — for historical parity only; the zone is canonical.)

### D.3 Transform semantics

```
T = { x, y, scale }
```

`(T.x, T.y)` is the **photo's top-left corner in mockup natural-pixel space**. `T.scale` is an **absolute multiplier on the photo's natural dimensions**: the photo's drawn rectangle in mockup space is `(T.x, T.y, Wp·T.scale, Hp·T.scale)`. The transform is meaningful only alongside `(Z, Wm × Hm, Wp × Hp)`; the reference therefore persists `transform`, `frame_slug`, and `label_zone` side by side when saving artwork, and the SDK does the same (§8.3, §9). No rotation exists anywhere in the model.

### D.4 Initial cover fit

On first photo load:

```
fitScale = max(z.w / Wp, z.h / Hp)                 // classic cover fit
T₀ = clamp({ x: z.x, y: z.y, scale: fitScale })    // anchored at the zone's top-left, not centered
```

`fitScale` is retained for the life of the photo as the zoom baseline. Replacing the photo resets `T`, `fitScale`, and the zoom multiplier.

### D.5 Pan clamping — the 15% overlap rule

With drawn size `pw = Wp·T.scale`, `ph = Hp·T.scale` and `margin = 0.15`:

```
minX = z.x − pw + z.w·margin        maxX = z.x + z.w − z.w·margin
minY = z.y − ph + z.h·margin        maxY = z.y + z.h − z.h·margin
T.x ← min(maxX, max(minX, T.x))     T.y ← min(maxY, max(minY, T.y))
```

Interpretation: the photo must always overlap **at least 15% of the zone's extent on each axis**. This is deliberately permissive — full window coverage is *not* enforced, and the shopper may leave parts of the label photo-free (the print canvas shows the cutout art over blank space there). Clamping is applied after every pan step, zoom step, and the initial fit.

### D.6 Zoom — center-anchored rescale

User zoom is a multiplier `m ∈ [1, 3]` over `fitScale` (buttons step 0.2; slider step 0.01); `scale = fitScale · m`. Zooming preserves the photo point currently under the **zone center** `(zc.x, zc.y) = (z.x + z.w/2, z.y + z.h/2)`:

```
u = (zc.x − T.x) / (Wp · T.scale)          // normalized photo-space coords of the zone center
v = (zc.y − T.y) / (Hp · T.scale)
T′ = clamp({ x: zc.x − u·Wp·scale′,  y: zc.y − v·Hp·scale′,  scale: scale′ })
```

### D.7 Opening analysis — where the image can be seen

Rendering never needs this section: the photo is drawn clipped to the zone (preview) or the canvas (print), and the cutout PNG over it hides everything its opaque pixels cover. The derived geometry exists for *layout decisions* — sizing drop targets, placing personalization text, choosing a photo-safe region — and is precomputed offline per cutout (`snapshot.mjs`), shipped in catalog data (Appendix B), with constants `ALPHA_THRESHOLD = 8` and normalized values rounded to six decimals.

Given the cutout's alpha channel `α[i] ∈ [0, 255]` on the 900 × 1200 grid:

1. **`fullyTransparentBounds`** — the bounding box and count of pixels with `α = 0` exactly (note: stricter than the threshold).
2. **`centerTransparentComponent`** — start at the center pixel (450, 600); if its `α > 8`, start instead at the transparent pixel (`α ≤ 8`) nearest the center by squared Euclidean distance. Flood-fill with **4-connectivity** over pixels with `α ≤ 8` (BFS in the reference). Record the component's bounding box, pixel count, start pixel, and whether the component **touches the canvas edge** (openings that bleed off-canvas behave differently for layout).
3. **`largestSafeTransparentRectangle`** — the largest axis-aligned rectangle in which *every* pixel has `α ≤ 8`: the maximal-rectangle-in-binary-matrix algorithm — per row, maintain a histogram of consecutive-transparent column heights and resolve maximal rectangles with a monotonic stack (O(W·H)). **Tie-break:** among equal-area candidates, prefer the rectangle whose center is nearest the canvas center (squared distance). This is the conservative photo-safe region.

Each rectangle is emitted in both pixel and normalized form. The alpha channel remains authoritative for anything visual; these rectangles are summaries of irregular masks.

### D.8 Export pipeline — three artifacts

**Print composite (the file that gets printed), 900 × 1200.** Map the zone onto the print canvas with independent axis scales, draw the photo, then the cutout at full canvas size:

```
sx = 900 / z.w                      sy = 1200 / z.h
photoX = (T.x − z.x) · sx           photoW = Wp · T.scale · sx
photoY = (T.y − z.y) · sy           photoH = Hp · T.scale · sy
draw photo at (photoX, photoY, photoW, photoH)     // canvas bounds crop it implicitly — no explicit clip
draw cutout PNG at (0, 0, 900, 1200)
```

Because `sx` and `sy` are independent, a zone whose aspect deviates from 3:4 stretches the photo anisotropically — the data discipline in D.2 is what keeps this correct.

**Low-resolution flag**, computed here: `lowRes = (photoW > 1.05·Wp) or (photoH > 1.05·Hp)` — equivalently, the mapping upscales the source beyond 105% of its native resolution. The reference surfaces this as a warning; it does not block saving.

**Display composite (mockup preview), width 1000.** `d = 1000 / Wm`; draw the mockup scaled by `d`; clip to the zone rectangle scaled by `d`; draw the photo at `(T.x·d, T.y·d, Wp·T.scale·d, Hp·T.scale·d)`; draw the cutout PNG into the zone rectangle (scaled to `z.w·d × z.h·d`); restore the clip.

**Source** — the original upload, passed through untouched.

The reference persists all three plus `{ transform, frame_slug, label_zone }` in one multipart save. The MVP SDK uploads source and print composite to the API at save time and keeps only references locally (§8.4, §9); the display composite backs `previewUrl`.

### D.9 Constants and SDK deltas

| Constant | Value |
|---|---|
| Print canvas | 900 × 1200 px (all cutout PNGs exactly this size, at origin) |
| Display composite width | 1000 px (mockup aspect preserved) |
| Zoom multiplier | 1–3; buttons step 0.2, slider step 0.01 |
| Pan clamp margin | 15% of zone extent per axis (minimum overlap) |
| Alpha threshold | ≤ 8 = "transparent" for derived geometry; `= 0` for fullyTransparentBounds |
| Low-res factor | upscale > 1.05 × native |
| Aspect precision | `toFixed(4)` on `Z.width / Z.height` |
| Normalized rounding | 6 decimals |
| Default editor width | 460 px (display-scale only; never affects the math) |

Behaviors the MVP SDK adds on top of the faithful port, without altering the math above: **personalization-text rendering** (absent from the reference editor — cutouts carry `personalization_text_position` ∈ `default | top | upper | bottom` as the placement hint, and the largest-safe-rectangle geometry helps keep text clear of the opening), and the **D.2 aspect check** emitted as a console warning. Deferred past MVP (§2): touch pinch-zoom and keyboard nudging as additional inputs into the same clamp/zoom equations, and an opt-in strict-coverage clamp mode — the reference-faithful 15% rule is the only mode in MVP.
