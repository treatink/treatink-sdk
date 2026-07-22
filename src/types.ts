/**
 * Public type contract for @treatink/sdk. This file is the source of truth for the public surface
 * (docs/10-public-types.md). Types only — no runtime. Nothing here may reference the DOM in a way
 * that couples the engine; keep UI-only types in their modules.
 */

/* ── Init ─────────────────────────────────────────────────────────────────── */

export interface TreatinkConfig {
  /** Publishable only: 'pk_test_…' | 'pk_live_…'. A secret ('sk_…') throws key_scope_violation. */
  apiKey: string;
  /** Registered storefront hostname, e.g. 'rileyspets.com'. Used SDK-side; NOT sent as a header. */
  channel: string;
  /** Default 'fixtures' until the live API is wired (docs/09). */
  mode?: 'live' | 'fixtures';
  /** Override for staging (https://staging.treatinkapi.com); default https://treatinkapi.com */
  apiBaseUrl?: string;
  theme?: ThemeConfig;
  copy?: Partial<CopyStrings>;
  /** Personalization-text cap fallback when a template has no maxTextLength (default 20). */
  maxPersonalizationLength?: number;
  debug?: boolean;
}

/* ── Instance ─────────────────────────────────────────────────────────────── */

export interface Treatink {
  readonly products: ProductsApi;
  readonly templates: TemplatesApi;
  readonly artwork: ArtworkApi;
  readonly designer: DesignerApi;
  readonly drafts: DraftsApi;
  readonly orders: OrdersApi;
  /** Subscribe to an event; returns an unsubscribe function. */
  on(event: TreatinkEvent, handler: (payload: unknown) => void): () => void;
  /** Present only in mode:'fixtures'. */
  readonly fixtures?: FixturesApi;
}

export type TreatinkEvent = 'designer:open' | 'designer:close' | 'draft:saved' | 'error';

/* ── Namespaces ───────────────────────────────────────────────────────────── */

export interface ProductsApi {
  list(params?: { limit?: number; cursor?: string }): Promise<Page<Product>>;
  get(sku: string): Promise<Product>;
}

export interface TemplatesApi {
  list(params: { sku: string; limit?: number; cursor?: string }): Promise<Page<Template>>;
}

export interface ArtworkApi {
  /** Runs the full two-step flow (declare → PUT bytes → finalize) and returns the final asset. */
  upload(input: { role: AssetRole; file: Blob; sha256?: string }): Promise<Asset>;
}

export interface DesignerApi {
  open(options: DesignerOptions): void;
  close(): void;
}

export interface DraftsApi {
  list(): DraftRecord[];
  get(draftId: string): DraftRecord | null;
  delete(draftId: string): void;
  clear(): void;
}

export interface OrdersApi {
  /** Pure; no network, nothing secret. Assembles the docs/08 §7 order body. */
  buildPayload(input: BuildPayloadInput): OrderPayload;
}

export interface FixturesApi {
  failNext(op: string, error: { status: number; code: string }): void;
  setLatency(ms: number): void;
}

/* ── Designer options & result ────────────────────────────────────────────── */

export type AssetRole = 'source' | 'rendered';
export type PetNamePosition = 'default' | 'top' | 'upper' | 'bottom';

/** {x,y,scale,rotation} in 900×1200 print-canvas pixels; self-contained for print re-render (docs/05 §8.2). */
export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

/** Normalized rectangle on the product mockup. */
export interface LabelZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesignerOptions {
  sku: string;
  /** Re-open a saved draft (re-save creates a new draft). */
  draftId?: string;
  personalizationText?: string;
  cutoutLabelId?: string;
  onComplete?(result: DesignerResult): void;
  onError?(error: TreatinkError): void;
  onClose?(): void;
}

export interface DesignerResult {
  /** UUID v4 — also the idempotency token. */
  draftId: string;
  sku: string;
  variantId?: string;
  cutoutLabelId: string;
  personalizationText?: string | null;
  petNamePosition?: PetNamePosition;
  /** LOCAL object URL of the display composite (mockup + label in zone, docs/05 §8.1). Not uploaded. */
  previewUrl: string;
  artwork: { sourceAssetId: string; renderedAssetId: string };
  transform: Transform;
  labelZone: LabelZone;
  lowRes: boolean;
}

/* ── Catalog models (SDK-normalized; wire shapes in docs/08) ──────────────── */

export interface Product {
  sku: string;
  variantId: string;
  productId: string;
  title: string;
  description?: string;
  animalType?: 'cat' | 'dog' | 'horse';
  category?: string;
  productType?: string;
  status: string;
  priceCents: number;
  currency: string;
  images: { catalogImageUrl: string; regulatoryLabelUrl?: string };
  labelZone: LabelZone | null;
}

export interface Template {
  cutoutLabelId: string;
  title: string;
  category: 'standard' | 'holidays' | 'birthdays' | 'occasions';
  theme: 'light' | 'dark';
  petNamePosition: PetNamePosition;
  tags: string[];
  maskUrl: string;
  canvas: { width: 900; height: 1200 };
  opening: OpeningGeometry;
  /** Not in backend — SDK falls back to config.maxPersonalizationLength (default 20). */
  maxTextLength?: number;
}

export interface Asset {
  id: string;
  role: AssetRole;
  status: 'final';
  contentType: string;
  width: number;
  height: number;
  sha256: string;
}

export interface Page<T> {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
}

/** Precomputed alpha geometry (docs/08 §5). Consumed as-is; never decoded at runtime. */
export interface OpeningGeometry {
  alphaThreshold: number;
  fullyTransparentBounds: RectWithCount;
  centerTransparentComponent: RectWithCount & { touchesCanvasEdge: boolean };
  largestSafeTransparentRectangle: RectWithCount;
}
export interface RectWithCount {
  pixels: { x: number; y: number; width: number; height: number };
  normalized: { x: number; y: number; width: number; height: number };
  pixelCount?: number;
}

/* ── Draft record (localStorage — references only, no bytes) ──────────────── */

export interface DraftRecord {
  draftId: string;
  createdAt: string;
  updatedAt: string;
  channel: string;
  product: { sku: string; variantId?: string };
  cutout: { cutoutLabelId: string; petNamePosition?: PetNamePosition };
  personalizationText?: string | null;
  transform: Transform;
  labelZone: LabelZone;
  /** Remote refs (ids). NO image bytes, NO URLs. */
  artwork: { sourceAssetId: string; renderedAssetId: string };
  status: 'completed' | 'ordered';
}

/* ── Errors (docs/02 §4) ──────────────────────────────────────────────────── */

export class TreatinkError extends Error {
  /** API codes (docs/02 §4) + SDK-local: key_scope_violation, unsupported_file_type, upload_failed. */
  readonly code: string;
  readonly status?: number;
  readonly param?: string;
  readonly requestId?: string;

  constructor(
    code: string,
    message: string,
    options?: { status?: number; param?: string; requestId?: string; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'TreatinkError';
    this.code = code;
    if (options?.status !== undefined) this.status = options.status;
    if (options?.param !== undefined) this.param = options.param;
    if (options?.requestId !== undefined) this.requestId = options.requestId;
  }
}

/* ── Theme, copy, order payload ───────────────────────────────────────────── */

/**
 * Defaults are the exact store palette (docs/13 §1, VP-01). Derived tokens (primaryStrong,
 * panelBackground, accentHover, surfaceAlt, buttonRadius, controlRadius) resolve explicit-wins:
 * set them for full control, or override only the base token (primary/accent/borderRadius) and
 * the SDK derives a coherent shade/step-down for you.
 */
export interface ThemeConfig {
  /** Purple family base. Default '#a99cdf' (store --purple). */
  primary?: string;
  /** Darker primary: slider track, purple-button hovers. Default '#8c7ec2' (store --purple-darker). */
  primaryStrong?: string;
  /** Control-card background. Default '#e2e6ff' (store --purple-light). */
  panelBackground?: string;
  /** Orange family base: save CTA, pagination dots, upload icon. Default '#ffa518' (store --orange). */
  accent?: string;
  /** Save-CTA hover. Default '#dd9133' (store --orange-hover). */
  accentHover?: string;
  headerBackground?: string;
  headerText?: string;
  surface?: string;
  /** Browse-All modal surface + close button. Default '#F6F6FC' (store --purple-extra-light). */
  surfaceAlt?: string;
  /** Card radius (modal, canvas frame, control cards). Default '20px'. */
  borderRadius?: string;
  /** Filled-button radius (save, picker). Default '15px'. */
  buttonRadius?: string;
  /** Chips/thumbs/inputs radius. Default '10px'. */
  controlRadius?: string;
  fontFamily?: string;
  overlayColor?: string;
  zIndex?: number;
  logo?: string | false;
}

export interface CopyStrings {
  headerTitle: string;
  closeLabel: string;
  /** May contain '\n' — rendered as separate lines (store two-line prompt). */
  uploadPrompt: string;
  uploadButton: string;
  /** Retained for compatibility; unused since the zoom −/+ buttons were removed (docs/13 §5.1, VP-03). */
  zoomInLabel: string;
  /** Retained for compatibility; unused since the zoom −/+ buttons were removed (docs/13 §5.1, VP-03). */
  zoomOutLabel: string;
  zoomSliderLabel: string;
  /** The "Browse All" button under the cutout pager (docs/13 §5.3). */
  categoryAll: string;
  imageControlsLabel: string;
  rotateLeftLabel: string;
  rotateRightLabel: string;
  deleteImageLabel: string;
  /** Cutout-card heading. Store: 'Choose Your Background'. */
  cutoutsLabel: string;
  /** Browse-All modal title. Store: 'Browse All Backgrounds'. */
  browseAllTitle: string;
  searchPlaceholder: string;
  noCutoutsFound: string;
  personalizationTextLabel: string;
  personalizationTextPlaceholder: string;
  lowResWarning: string;
  saveButton: string;
  savingLabel: string;
  saveErrorRetry: string;
  genericError: string;
}

/**
 * Input for orders.buildPayload — mirrors the REAL POST /v1/orders contract
 * (treatink-api orders/schemas.py, 2026-07-22; docs/08 §7). The wire schema is strict
 * (`extra="forbid"`, nullable fields must be PRESENT) — buildPayload emits explicit nulls.
 */
export interface BuildPayloadInput {
  /** Unique per partner+mode (DB constraint); also the default Idempotency-Key. */
  externalOrderId: string;
  displayOrderNumber?: string | null;
  /** The API accepts only 'USD' today. */
  currency: 'USD';
  /** At least one of email/phone is required (wire rule). */
  recipient: { name: string; email?: string | null; phone?: string | null };
  destination: {
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    region?: string | null;
    postalCode?: string | null;
    /** ISO 3166-1 alpha-2, e.g. 'US'. */
    countryCode: string;
  };
  /** delivery_method is always 'ship_to_recipient' (the only wire value). */
  fulfillment?: { instructions?: string | null };
  /** Partner-reported USD integer cents; reconciled server-side. */
  amounts: {
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
  };
  lines: Array<{
    /** REQUIRED and unique within the order (wire rule). */
    externalLineItemId: string;
    /** Pulls variant_id, asset ids, cutout id, and pet_name from the draft. */
    draftId: string;
    /** 1–100. */
    quantity: number;
    unitPriceCents: number;
    /** Default: quantity × unitPriceCents. */
    subtotalCents?: number;
  }>;
}

/** The exact wire body assembled by buildPayload (snake_case; docs/08 §7). Opaque to consumers. */
export type OrderPayload = Record<string, unknown>;
