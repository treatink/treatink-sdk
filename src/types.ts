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
  /** Override for staging; default https://api.treatink.com */
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
  list(params?: PageParams): Promise<Page<Product>>;
  get(sku: string): Promise<Product>;
}

export interface TemplatesApi {
  list(params: { sku: string } & PageParams): Promise<Page<Template>>;
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
export interface PageParams {
  limit?: number;
  cursor?: string;
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

export interface ThemeConfig {
  primary?: string;
  accent?: string;
  headerBackground?: string;
  headerText?: string;
  surface?: string;
  borderRadius?: string;
  fontFamily?: string;
  overlayColor?: string;
  zIndex?: number;
  logo?: string | false;
}

export interface CopyStrings {
  headerTitle: string;
  closeLabel: string;
  uploadPrompt: string;
  uploadButton: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  zoomSliderLabel: string;
  categoryAll: string;
  personalizationTextLabel: string;
  personalizationTextPlaceholder: string;
  lowResWarning: string;
  saveButton: string;
  savingLabel: string;
  saveErrorRetry: string;
  genericError: string;
}

export interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}

export interface BuildPayloadInput {
  externalOrderId: string;
  channelOrderNumber?: string;
  currency: string;
  paymentStatus: string;
  customer: { email: string; firstName?: string; lastName?: string };
  shippingAddress?: ShippingAddress;
  lines: Array<{
    externalLineItemId?: string;
    /** Pulls variantId, asset ids, personalization from the draft. */
    draftId: string;
    quantity: number;
    unitPriceCents: number;
    subtotalCents?: number;
  }>;
}

/** The exact wire body assembled by buildPayload (snake_case; docs/08 §7). Opaque to consumers. */
export type OrderPayload = Record<string, unknown>;
