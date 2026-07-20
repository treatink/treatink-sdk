import { TreatinkError } from '../types.js';
import { SDK_ERROR_CODES, fromEnvelope, type ApiErrorEnvelope } from './errors.js';

/**
 * FixtureTransport — the bundled backend simulation (Charter §11, docs/08). Reproduces the wire
 * contract EXACTLY (field names, nesting, id prefixes, error envelope) so switching to live is a
 * config change, not a rewrite. Wire-level ops here; catalog normalization is the adapter's job
 * (P1-T07), which builds the `Transport`-interface conformance on top.
 *
 * - No sessions (GP-18). No network — "PUT" stores bytes in memory; a local object URL stands in
 *   for uploaded artwork where the platform supports it (Charter §11).
 * - `failNext(op, { status, code })` makes the next call to `op` fail with the exact docs/08 §8
 *   envelope (matching `type` per class, deterministic `req_fx_…` request id).
 * - Deterministic ids/timestamps: `ast_fx_…`, `ord_fx_…`, clock fixed at docs/08's example instant.
 */

/* ── Wire shapes (docs/08; snake_case verbatim) ───────────────────────────── */

export interface CatalogPageWire<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface ChannelWire {
  id: string;
  name: string;
  mode: 'test' | 'live';
  key_class: 'publishable' | 'secret';
  permissions: string[];
}

export interface MediaWire {
  url: string;
  expires_at: string;
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  sha256: string;
}

export interface ProductWire {
  id: string;
  title: string;
  description: string;
  animal_type: 'cat' | 'dog' | 'horse';
  category: string;
  product_type: string;
  status: string;
}

export interface VariantWire {
  id: string;
  product_id: string;
  sku: string;
  description: string;
  short_description: string;
  option_values: Record<string, string>;
  currency: string;
  suggested_retail_cents: number;
  availability: string;
  fulfillment_eligibility: { policy: string; country_codes: string[] };
  catalog_image: MediaWire;
  regulatory_label_image: MediaWire | null;
  label_zone: { x: number; y: number; width: number; height: number } | null;
}

export interface BundleWire {
  id: string;
  name: string;
  description: string;
  animal_type: string;
  currency: string;
  raw_total_cents: number;
  discount_cents: number;
  suggested_retail_cents: number;
  variant_ids: string[];
}

export interface RectWire {
  pixels: {
    x: number;
    y: number;
    width: number;
    height: number;
    right_exclusive: number;
    bottom_exclusive: number;
  };
  normalized: { x: number; y: number; width: number; height: number };
  pixel_count?: number;
}

export interface CutoutLabelWire {
  id: string;
  title: string;
  category: 'standard' | 'holidays' | 'birthdays' | 'occasions';
  theme: 'light' | 'dark';
  pet_name_position: 'default' | 'top' | 'upper' | 'bottom';
  description: string;
  tags: string[];
  mask: MediaWire;
  canvas: { width: number; height: number };
  placement: Record<string, unknown>;
  alpha_threshold: number;
  center_pixel_alpha: number;
  alpha_stats: {
    total_pixels: number;
    fully_transparent_pixels: number;
    semitransparent_pixels: number;
    opaque_pixels: number;
    fully_transparent_fraction: number;
    semitransparent_fraction: number;
    opaque_fraction: number;
  };
  fully_transparent_bounds: RectWire;
  non_opaque_bounds: RectWire;
  center_transparent_component: RectWire & {
    start_pixel: { x: number; y: number; alpha: number };
    touches_canvas_edge: boolean;
  };
  largest_safe_transparent_rectangle: RectWire & { pixel_area: number };
}

export interface ArtworkCreateRequestWire {
  role: 'source' | 'rendered';
  content_type: string;
  size_bytes: number;
  sha256: string;
}

export interface UploadAuthorizationWire {
  method: 'PUT';
  url: string;
  expires_at: string;
  headers: Record<string, string>;
}

export interface ArtworkPendingWire {
  id: string;
  role: 'source' | 'rendered';
  status: 'pending';
  content_type: string;
  size_bytes: number;
  sha256: string;
  created_at: string;
  pending_expires_at: string;
  upload: UploadAuthorizationWire;
}

export interface ArtworkFinalWire {
  id: string;
  role: 'source' | 'rendered';
  status: 'final';
  content_type: string;
  size_bytes: number;
  width: number;
  height: number;
  sha256: string;
  created_at: string;
  finalized_at: string;
}

export interface OrderEchoWire {
  id: string;
  order_number: string;
  status: 'received';
  external_order_id: string;
  created_at: string;
  line_items: Array<{
    id: string;
    external_line_item_id: string | null;
    variant_id: string;
    sku: string;
    quantity: number;
  }>;
}

export interface FixtureDataset {
  channel: ChannelWire;
  products: ProductWire[];
  variants: VariantWire[];
  bundles: BundleWire[];
  cutoutLabels: CutoutLabelWire[];
}

export type FixtureOp =
  | 'channel.get'
  | 'products.list'
  | 'variants.list'
  | 'bundles.list'
  | 'cutoutLabels.list'
  | 'assets.declare'
  | 'assets.put'
  | 'assets.finalize'
  | 'orders.submit';

export interface PageParamsWire {
  limit?: number;
  cursor?: string;
}

/* ── Envelope construction (docs/08 §8; type strings from treatink-api errors.py) ── */

/** Public messages are generic by design (errors.py). Used for simulated failures too. */
const MESSAGE_BY_CODE: Record<string, string> = {
  bad_request: 'Bad Request.',
  invalid_cursor: 'The pagination cursor is invalid.',
  invalid_api_key: 'A valid API key is required.',
  insufficient_permissions: 'The API key does not have permission for this operation.',
  not_found: 'The requested resource does not exist.',
  upload_quota_exceeded: 'The upload quota has been reached.',
  upload_incomplete: 'The upload is not ready to finalize.',
  upload_expired: 'The upload authorization has expired.',
  asset_not_final: 'The asset is not finalized.',
  cutout_label_not_final: 'The cutout label is not finalized.',
  upload_too_large: 'The upload exceeds the allowed size.',
  unsupported_media_type: 'The upload media type is not supported.',
  validation_error: 'The request is invalid.',
  upload_validation_failed: 'The uploaded file is invalid.',
  service_unavailable: 'The service is temporarily unavailable. Please retry shortly.',
};

const PARAM_BY_CODE: Record<string, string> = {
  invalid_cursor: 'cursor',
  upload_too_large: 'size_bytes',
  unsupported_media_type: 'content_type',
};

/** `type` per class — verbatim from treatink-api errors.py (401/403/4xx/5xx). */
export function errorTypeForStatus(status: number): string {
  if (status === 401) return 'authentication_error';
  if (status === 403) return 'permission_error';
  if (status < 500) return 'invalid_request_error';
  return 'api_error';
}

export function buildEnvelope(
  status: number,
  code: string,
  requestId: string,
  overrides?: { message?: string; param?: string },
): ApiErrorEnvelope {
  return {
    error: {
      type: errorTypeForStatus(status),
      code,
      message: overrides?.message ?? MESSAGE_BY_CODE[code] ?? 'Simulated failure.',
      ...((overrides?.param ?? PARAM_BY_CODE[code]) !== undefined
        ? { param: overrides?.param ?? PARAM_BY_CODE[code] }
        : {}),
      request_id: requestId,
    },
  };
}

/* ── The simulated backend ────────────────────────────────────────────────── */

/** Fixed clock: docs/08's example instant. Deterministic outputs, stable goldens. */
const FIXTURE_NOW = '2026-07-20T12:00:00Z';
const FIXTURE_PLUS_1M = '2026-07-20T12:01:00Z';
const FIXTURE_PLUS_10M = '2026-07-20T12:10:00Z';
const FIXTURE_PLUS_15M = '2026-07-20T12:15:00Z';

const WIRE_MAX_UPLOAD_BYTES = 50_000_000; // API-side cap; the SDK enforces 25 MB before declare
const UPLOAD_CONTENT_TYPES = ['image/png', 'image/jpeg'];

const EMPTY_DATASET: FixtureDataset = {
  channel: {
    id: 'chn_fx_00000000000000000000000000a',
    name: 'Fixture Channel',
    mode: 'test',
    key_class: 'publishable',
    permissions: ['artwork_upload', 'catalog_read', 'channel_read'],
  },
  products: [],
  variants: [],
  bundles: [],
  cutoutLabels: [],
};

interface PendingRecord {
  declared: ArtworkPendingWire;
  bytes: Blob | null;
  objectUrl: string | null;
  final: ArtworkFinalWire | null;
}

export class FixtureTransport {
  readonly #data: FixtureDataset;
  readonly #measure: ((bytes: Blob) => Promise<{ width: number; height: number }>) | null;
  #latencyMs = 0;
  #requestSeq = 0;
  #assetSeq = 0;
  #orderSeq = 0;
  readonly #failures = new Map<FixtureOp, { status: number; code: string }[]>();
  readonly #assets = new Map<string, PendingRecord>();
  readonly #orders = new Map<string, OrderEchoWire>();

  constructor(options?: {
    data?: Partial<FixtureDataset>;
    /** Optional real-dimension probe (browser). Default: docs/08's example dims. */
    measure?: (bytes: Blob) => Promise<{ width: number; height: number }>;
  }) {
    this.#data = { ...EMPTY_DATASET, ...options?.data };
    this.#measure = options?.measure ?? null;
  }

  /* ── Test controls (Charter §11) ── */

  failNext(op: FixtureOp, error: { status: number; code: string }): void {
    const queue = this.#failures.get(op) ?? [];
    queue.push(error);
    this.#failures.set(op, queue);
  }

  setLatency(ms: number): void {
    this.#latencyMs = Math.max(0, ms);
  }

  /* ── Wire endpoints ── */

  async channel(): Promise<ChannelWire> {
    await this.#begin('channel.get');
    return structuredClone(this.#data.channel);
  }

  async catalogProducts(params?: PageParamsWire): Promise<CatalogPageWire<ProductWire>> {
    await this.#begin('products.list');
    return this.#paginate(this.#data.products, params);
  }

  async catalogVariants(params?: PageParamsWire): Promise<CatalogPageWire<VariantWire>> {
    await this.#begin('variants.list');
    return this.#paginate(this.#data.variants, params);
  }

  async catalogBundles(params?: PageParamsWire): Promise<CatalogPageWire<BundleWire>> {
    await this.#begin('bundles.list');
    return this.#paginate(this.#data.bundles, params);
  }

  async catalogCutoutLabels(params?: PageParamsWire): Promise<CatalogPageWire<CutoutLabelWire>> {
    await this.#begin('cutoutLabels.list');
    return this.#paginate(this.#data.cutoutLabels, params);
  }

  /** 6a — POST /v1/assets. Client computes sha256 + size_bytes first. */
  async assetsDeclare(req: ArtworkCreateRequestWire): Promise<ArtworkPendingWire> {
    await this.#begin('assets.declare');
    if (req.role !== 'source' && req.role !== 'rendered') {
      throw this.#apiError(422, 'validation_error', { param: 'role' });
    }
    if (!UPLOAD_CONTENT_TYPES.includes(req.content_type)) {
      throw this.#apiError(415, 'unsupported_media_type');
    }
    if (!Number.isInteger(req.size_bytes) || req.size_bytes <= 0) {
      throw this.#apiError(422, 'validation_error', { param: 'size_bytes' });
    }
    if (req.size_bytes > WIRE_MAX_UPLOAD_BYTES) {
      throw this.#apiError(413, 'upload_too_large');
    }
    if (!/^[0-9a-f]{64}$/.test(req.sha256)) {
      throw this.#apiError(422, 'validation_error', { param: 'sha256' });
    }
    const id = `ast_fx_${String(++this.#assetSeq).padStart(8, '0')}`;
    const declared: ArtworkPendingWire = {
      id,
      role: req.role,
      status: 'pending',
      content_type: req.content_type,
      size_bytes: req.size_bytes,
      sha256: req.sha256,
      created_at: FIXTURE_NOW,
      pending_expires_at: FIXTURE_PLUS_15M,
      upload: {
        method: 'PUT',
        url: `https://storage.treatink.local/fixtures/${id}?X-signed=fx`,
        expires_at: FIXTURE_PLUS_10M,
        headers: { 'Content-Type': req.content_type },
      },
    };
    this.#assets.set(id, { declared, bytes: null, objectUrl: null, final: null });
    return structuredClone(declared);
  }

  /** 6b — the browser PUT, simulated: bytes stay in memory; NEVER any network. */
  async assetsPut(upload: UploadAuthorizationWire, bytes: Blob): Promise<void> {
    await this.#begin('assets.put');
    const record = [...this.#assets.values()].find((r) => r.declared.upload.url === upload.url);
    if (!record) {
      throw this.#apiError(404, 'not_found');
    }
    record.bytes = bytes;
    // Charter §11: "uploaded" artwork becomes a local object URL where the platform has one.
    const urlApi = (globalThis as { URL?: { createObjectURL?: (b: Blob) => string } }).URL;
    record.objectUrl = urlApi?.createObjectURL ? urlApi.createObjectURL(bytes) : null;
  }

  /** 6c — POST /v1/assets/{id}/finalize. Returns NO url (GP-08). */
  async assetsFinalize(assetId: string): Promise<ArtworkFinalWire> {
    await this.#begin('assets.finalize');
    const record = this.#assets.get(assetId);
    if (!record) {
      throw this.#apiError(404, 'not_found');
    }
    if (record.final) {
      return structuredClone(record.final); // idempotent re-finalize
    }
    if (!record.bytes) {
      throw this.#apiError(409, 'upload_incomplete');
    }
    const dims = this.#measure ? await this.#measure(record.bytes) : { width: 2048, height: 1536 }; // docs/08 §6c example dims; browsers pass a real probe
    const d = record.declared;
    record.final = {
      id: d.id,
      role: d.role,
      status: 'final',
      content_type: d.content_type,
      size_bytes: d.size_bytes,
      width: dims.width,
      height: dims.height,
      sha256: d.sha256,
      created_at: d.created_at,
      finalized_at: FIXTURE_PLUS_1M,
    };
    return structuredClone(record.final);
  }

  /** §7 — order echo; idempotent on external_order_id. */
  async ordersSubmit(body: Record<string, unknown>): Promise<OrderEchoWire> {
    await this.#begin('orders.submit');
    const externalOrderId = body['external_order_id'];
    if (typeof externalOrderId !== 'string' || externalOrderId === '') {
      throw this.#apiError(422, 'validation_error', { param: 'external_order_id' });
    }
    const existing = this.#orders.get(externalOrderId);
    if (existing) {
      return structuredClone(existing); // re-posting the same external_order_id returns the original
    }
    const seq = ++this.#orderSeq;
    const lines = Array.isArray(body['line_items']) ? (body['line_items'] as unknown[]) : [];
    const echo: OrderEchoWire = {
      id: `ord_fx_${String(seq).padStart(8, '0')}`,
      order_number: String(1000 + seq),
      status: 'received',
      external_order_id: externalOrderId,
      created_at: FIXTURE_NOW,
      line_items: lines.map((raw, i) => {
        const line = raw as Record<string, unknown>;
        return {
          id: `oli_fx_${String(seq).padStart(4, '0')}_${i + 1}`,
          external_line_item_id:
            typeof line['external_line_item_id'] === 'string'
              ? line['external_line_item_id']
              : null,
          variant_id: typeof line['variant_id'] === 'string' ? line['variant_id'] : '',
          sku: typeof line['sku'] === 'string' ? line['sku'] : '',
          quantity: Number(line['quantity'] ?? 0),
        };
      }),
    };
    this.#orders.set(externalOrderId, echo);
    return structuredClone(echo);
  }

  /** Fixture-only: the local stand-in URL for "uploaded" bytes (null outside browsers). */
  localObjectUrl(assetId: string): string | null {
    return this.#assets.get(assetId)?.objectUrl ?? null;
  }

  /* ── Internals ── */

  async #begin(op: FixtureOp): Promise<void> {
    if (this.#latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.#latencyMs));
    }
    const queue = this.#failures.get(op);
    const planned = queue?.shift();
    if (queue && queue.length === 0) this.#failures.delete(op);
    if (planned) {
      // SDK-local codes (e.g. upload_failed for the browser-PUT path) never come as envelopes.
      if ((SDK_ERROR_CODES as readonly string[]).includes(planned.code)) {
        throw new TreatinkError(planned.code, 'Simulated failure.', { status: planned.status });
      }
      throw this.#apiError(planned.status, planned.code);
    }
  }

  #apiError(
    status: number,
    code: string,
    overrides?: { message?: string; param?: string },
  ): TreatinkError {
    const requestId = `req_fx_${String(++this.#requestSeq).padStart(6, '0')}`;
    return fromEnvelope(status, buildEnvelope(status, code, requestId, overrides));
  }

  #paginate<T>(items: T[], params?: PageParamsWire): CatalogPageWire<T> {
    const limit = params?.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw this.#apiError(422, 'validation_error', { param: 'limit' });
    }
    let start = 0;
    if (params?.cursor !== undefined) {
      const match = /^cur_fx_(\d+)$/.exec(params.cursor);
      if (!match) {
        throw this.#apiError(400, 'invalid_cursor');
      }
      start = Number(match[1]);
      if (start > items.length) {
        throw this.#apiError(400, 'invalid_cursor');
      }
    }
    const data = structuredClone(items.slice(start, start + limit));
    const end = start + data.length;
    return {
      data,
      has_more: end < items.length,
      next_cursor: end < items.length ? `cur_fx_${end}` : null,
    };
  }
}
