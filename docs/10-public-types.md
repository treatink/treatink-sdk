# 10 · Public Types (frozen contract)

The public TypeScript surface of `@treatink/sdk`. **This is the contract** — `src/types.ts` must
match it, `index.ts` exports exactly these, and no public symbol exists that isn't here (`docs/02`
§2). It supersedes Charter §6 where the two differ; the deltas (asset model, no sessions, real error
codes) are listed in §9 with rationale.

Adopted decisions baked in: no `sessions` namespace (GP-18), two-step asset upload (GP-04), local
preview (GP-08), real error codes (GP-06).

## 1. Entry

```ts
const tk: Treatink = Treatink.init(config: TreatinkConfig);

interface TreatinkConfig {
  apiKey: string;                 // publishable only: 'pk_test_…' | 'pk_live_…'.
                                  //   'sk_…' (or any non-pk_) throws key_scope_violation (§7)
  channel: string;                // registered storefront hostname (e.g. 'rileyspets.com')
  mode?: 'live' | 'fixtures';     // default 'fixtures' until the live API is wired (docs/09)
  apiBaseUrl?: string;            // staging: https://staging.treatinkapi.com; default https://treatinkapi.com
  theme?: ThemeConfig;
  copy?: Partial<CopyStrings>;
  maxPersonalizationLength?: number;  // text-cap fallback when a template has no maxTextLength (§5; default 20)
  debug?: boolean;
}
```

## 2. Instance

```ts
interface Treatink {
  products:  ProductsApi;
  templates: TemplatesApi;        // cutout-labels
  artwork:   ArtworkApi;          // two-step asset upload
  designer:  DesignerApi;
  drafts:    DraftsApi;
  orders:    OrdersApi;           // buildPayload only (browser, no network)
  on(event: TreatinkEvent, handler: (payload: unknown) => void): () => void;
  fixtures?: FixturesApi;         // present only in mode:'fixtures'
}

type TreatinkEvent = 'designer:open' | 'designer:close' | 'draft:saved' | 'error';
```

> **No `sessions` namespace** — the backend is asset-based (GP-18). The designer's save orchestrates
> assets internally.

## 3. Namespaces

```ts
interface ProductsApi {
  list(params?: { limit?: number; cursor?: string }): Promise<Page<Product>>;
  get(sku: string): Promise<Product>;                  // resolves SKU → its variant (docs/04 §2.4)
}

interface TemplatesApi {                               // cutout-labels
  list(params: { sku: string; limit?: number; cursor?: string }): Promise<Page<Template>>;
}

interface ArtworkApi {
  // Runs the full two-step flow (declare → PUT bytes → finalize) and returns the final asset.
  upload(input: { role: AssetRole; file: Blob; sha256?: string }): Promise<Asset>;
}
type AssetRole = 'source' | 'rendered';

interface DesignerApi {
  open(options: DesignerOptions): void;
  close(): void;
}

interface DraftsApi {
  list(): DraftRecord[];
  get(draftId: string): DraftRecord | null;
  delete(draftId: string): void;
  clear(): void;
}

interface OrdersApi {
  buildPayload(input: BuildPayloadInput): OrderPayload;   // pure; no network, nothing secret
}

interface FixturesApi {
  failNext(op: string, error: { status: number; code: string }): void;
  setLatency(ms: number): void;
}
```

## 4. Designer options & result

```ts
interface DesignerOptions {
  sku: string;                              // required
  draftId?: string;                         // re-open a saved draft (re-save creates a new draft)
  personalizationText?: string;             // prefill
  cutoutLabelId?: string;                   // preselect a cutout (was templateKey)
  onComplete?(result: DesignerResult): void;
  onError?(error: TreatinkError): void;
  onClose?(): void;
}

interface DesignerResult {
  draftId: string;                          // UUID v4 — also the idempotency token
  sku: string;
  variantId?: string;                       // resolved 'var_…'
  cutoutLabelId: string;                    // 'cut_…' (was templateKey)
  personalizationText?: string | null;
  petNamePosition?: PetNamePosition;
  previewUrl: string;                       // LOCAL object URL of the DISPLAY composite —
                                            //   product mockup + label in label_zone (docs/05 §8.1); not uploaded
  artwork: { sourceAssetId: string; renderedAssetId: string };   // 'ast_…' ids (GP-08: no URLs)
  transform: Transform;                     // docs/05 §2
  labelZone: LabelZone;                     // interpreting context (docs/05 §9)
  lowRes: boolean;                          // docs/05 §8
}

type PetNamePosition = 'default' | 'top' | 'upper' | 'bottom';
// Transform is in 900×1200 print-canvas pixels and is self-contained for print re-render (docs/05 §8.2).
interface Transform  { x: number; y: number; scale: number; rotation: number }  // rotation 0 in MVP
interface LabelZone  { x: number; y: number; width: number; height: number }     // normalized
```

## 5. Catalog models (SDK-normalized; wire shapes in `docs/08`)

```ts
interface Product {
  sku: string; variantId: string; productId: string;
  title: string; description?: string;
  animalType?: 'cat' | 'dog' | 'horse';
  category?: string; productType?: string; status: string;
  priceCents: number; currency: string;
  images: { catalogImageUrl: string; regulatoryLabelUrl?: string };
  labelZone: LabelZone | null;              // null for no-zone products (edge case)
}

interface Template {                        // a cutout-label
  cutoutLabelId: string;                    // 'cut_…'
  title: string;
  category: 'standard' | 'holidays' | 'birthdays' | 'occasions';
  theme: 'light' | 'dark';
  petNamePosition: PetNamePosition;
  tags: string[];
  maskUrl: string;                          // the cutout PNG (alpha = the mask)
  canvas: { width: 900; height: 1200 };
  opening: OpeningGeometry;                 // precomputed alpha geometry (docs/08 §5) — not decoded at runtime
  maxTextLength?: number;                   // personalization-text cap. NOT in the backend model —
                                            //   SDK falls back to config `maxPersonalizationLength`
                                            //   (default 20); visual auto-shrink still applies (docs/05 §7)
}

interface Asset {                           // finalized artwork asset
  id: string;                               // 'ast_…'
  role: AssetRole;
  status: 'final';
  contentType: string; width: number; height: number; sha256: string;
}

interface Page<T> { data: T[]; hasMore: boolean; nextCursor: string | null }
type OpeningGeometry = { /* alphaThreshold, fullyTransparentBounds, centerTransparentComponent,
                            largestSafeTransparentRectangle, … — see docs/08 §5 */ };
```

## 6. Draft record (localStorage — references only, GP-05)

```ts
// keys: treatink:v1:<channel>:index  and  treatink:v1:<channel>:draft:<draftId>
interface DraftRecord {
  draftId: string;                          // UUID v4 — idempotency token
  createdAt: string; updatedAt: string;
  channel: string;
  product: { sku: string; variantId?: string };
  cutout:  { cutoutLabelId: string; petNamePosition?: PetNamePosition };
  personalizationText?: string | null;
  transform: Transform;
  labelZone: LabelZone;
  artwork: { sourceAssetId: string; renderedAssetId: string };   // remote refs (ids). NO image bytes, NO URLs
  status: 'completed' | 'ordered';
}
```

**Re-open behavior (MVP).** `designer.open({ draftId })` restores all *metadata* (cutout, transform,
text, zone). It **cannot** re-hydrate the original photo pixels: no image bytes are stored (Charter
§9) and a publishable key cannot GET the uploaded `source` asset back (`docs/04` §2.3, GP-08). So MVP
re-open of a draft restores the layout and asks the shopper to re-select the photo to edit it;
re-saving creates a fresh draft + assets (in-place re-edit is deferred, Charter §2). *Known
limitation — documented, not a bug.*

## 7. Errors (GP-06)

```ts
class TreatinkError extends Error {
  code: string;        // API codes (docs/02 §4) + SDK-local: key_scope_violation,
                       //   unsupported_file_type, upload_failed
  status?: number;
  param?: string;
  requestId?: string;
}
```

## 8. Theme, copy, order payload

```ts
// Defaults = the EXACT store palette (docs/13 §1, VP-01 — supersedes Charter §7.3).
// Derived tokens resolve explicit-wins: set them for full control, or override only the base
// (primary/accent/borderRadius) and the SDK derives coherent shades via color-mix()/min().
interface ThemeConfig {                     // → --tk-* CSS vars (docs/13 §1)
  primary?: string;          // default #a99cdf (store --purple)
  primaryStrong?: string;    // default #8c7ec2 (store --purple-darker); derives from primary
  panelBackground?: string;  // default #e2e6ff (store --purple-light); derives from primary
  accent?: string;           // default #ffa518 (store --orange)
  accentHover?: string;      // default #dd9133 (store --orange-hover); derives from accent
  headerBackground?: string; // default #F26B1D (SDK modal chrome, VP-04)
  headerText?: string;
  surface?: string;
  surfaceAlt?: string;       // default #F6F6FC (store --purple-extra-light); derives from primary
  borderRadius?: string;     // default '20px' (cards)
  buttonRadius?: string;     // default '15px' (filled buttons); min()-derives from borderRadius
  controlRadius?: string;    // default '10px' (chips/thumbs/inputs); min()-derives from borderRadius
  fontFamily?: string;       // Montserrat/Mitr + system fallback
  overlayColor?: string;
  zIndex?: number;           // default 2147483000
  logo?: string | false;
}

interface CopyStrings {                     // every user-visible designer string — all overridable
  headerTitle: string;                 // 'Personalize Your Product'
  closeLabel: string;
  uploadPrompt: string;                // "Drag your pet's photo here\nand start personalizing!"
  uploadButton: string;                // 'Or Select Image'
  zoomInLabel: string; zoomOutLabel: string;  // compat only — no −/+ buttons (VP-03)
  zoomSliderLabel: string;
  categoryAll: string;                 // 'Browse All' (the button under the pager)
  imageControlsLabel: string;          // 'Image Controls'
  rotateLeftLabel: string; rotateRightLabel: string; deleteImageLabel: string;
  cutoutsLabel: string;                // 'Choose Your Background'
  browseAllTitle: string;              // 'Browse All Backgrounds'
  searchPlaceholder: string;           // 'Search'
  noCutoutsFound: string;              // 'No backgrounds found'
  personalizationTextLabel: string;    // 'Include Pet Name on Label' (store default)
  personalizationTextPlaceholder: string;  // 'Pet Name'
  lowResWarning: string;
  saveButton: string;                  // 'Save Customization'
  savingLabel: string; saveErrorRetry: string;
  genericError: string;
}

// Mirrors the REAL POST /v1/orders contract (2026-07-22, orders/schemas.py; docs/08 §7).
// The wire is strict: nullable fields must be present — buildPayload emits explicit nulls.
interface BuildPayloadInput {
  externalOrderId: string;             // unique per partner+mode; default Idempotency-Key
  displayOrderNumber?: string | null;
  currency: 'USD';                     // the API accepts USD only
  recipient: { name: string; email?: string | null; phone?: string | null };  // >=1 contact
  destination: {
    addressLine1: string; addressLine2?: string | null;
    city: string; region?: string | null; postalCode?: string | null;
    countryCode: string;               // ISO 3166-1 alpha-2
  };
  fulfillment?: { instructions?: string | null };   // delivery_method is always ship_to_recipient
  amounts: { subtotalCents: number; discountCents: number; shippingCents: number;
             taxCents: number; totalCents: number };
  lines: Array<{
    externalLineItemId: string;        // REQUIRED + unique (wire rule)
    draftId: string;                   // pulls variant_id, asset ids, cutout id, pet_name
    quantity: number;                  // 1..100
    unitPriceCents: number;
    subtotalCents?: number;            // default quantity x unitPriceCents
  }>;
}
// OrderPayload = the exact wire body in docs/08 §7 (snake_case, personalization block). Assembled here.
```

## 9. Deltas from Charter §6 (rationale)

| Charter §6 | This contract | Why |
|---|---|---|
| `tk.sessions.create/get` | **removed** | no sessions in the backend (GP-18) |
| `tk.artwork.upload({ sessionId, slot, file })` | `upload({ role, file })` | two-step asset model, roles `source`/`rendered` (GP-04) |
| `DesignerResult.sessionId`, `templateKey`, `artwork{originalUrl,printUrl}` | `cutoutLabelId`, `artwork{sourceAssetId,renderedAssetId}`, local `previewUrl` | assets not sessions; pk can't read asset URLs (GP-08) |
| `transform {x,y,scale}` | `+ rotation` | store model carries rotation (`docs/05`; 0 in MVP) |
| error codes `session_*`, `channel_not_registered`, `invalid_request` | real API codes | GP-06 / GP-19 |

| `BuildPayloadInput` (customer/shippingAddress/paymentStatus; per-line sku + transform/zone in personalization) | recipient/destination/fulfillment/amounts; personalization = asset ids + cutout id + pet_name only | the REAL POST /v1/orders landed 2026-07-22 with this strict shape — the live wire outranks the proposal (`docs/04` §2.7) |

Everything else (config, theme, copy, drafts semantics, `orders.buildPayload`, events) follows the
Charter.
