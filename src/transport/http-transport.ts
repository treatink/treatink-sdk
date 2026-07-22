import { TreatinkError } from '../types.js';
import type { Asset, AssetRole, Page, Product, Template } from '../types.js';
import type { ChannelInfo, PendingAsset, Transport, UploadAuthorization } from './transport.js';
import { toPage, toProduct, toTemplate } from '../catalog/adapter.js';
import { fromEnvelope, type ApiErrorEnvelope } from './errors.js';
import type {
  ArtworkFinalWire,
  ArtworkPendingWire,
  CatalogPageWire,
  ChannelWire,
  CutoutLabelWire,
  PageParamsWire,
  ProductWire,
  VariantWire,
} from './fixture-transport.js';

/**
 * HttpTransport — the LIVE backend seam (docs/01 §4, docs/04 §1). Implements the `Transport`
 * interface against the real, documented endpoints so switching `mode: 'live'` swaps the
 * implementation and nothing above the transport changes (README: "fixtures and http must be
 * swap-equal"). P4-T01 wired the catalog paths; P4-T02/T03 (2026-07-22, staging live) wire the
 * two-step asset flow (declare → presigned PUT → finalize) and templates via
 * `GET /v1/catalog/cutout-labels`.
 *
 * Contract (docs/04 §1, §2.8):
 * - Auth is `Authorization: Bearer <pk_…>` ONLY. **No channel header** — the tenant derives from the
 *   key, and the live CORS policy rejects any extra request header. `channel` is SDK-side only.
 * - Idempotent GETs retry with exponential backoff + jitter on transient (5xx / network) failures.
 * - The API error envelope maps to `TreatinkError` via the shared `fromEnvelope` (identical objects
 *   to fixture mode).
 */

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 200;
/** Match FixtureTransport.getProduct: scan a single full page to resolve a SKU (catalog is small). */
const FULL_PAGE: PageParamsWire = { limit: 100 };

export interface HttpTransportOptions {
  apiKey: string;
  apiBaseUrl: string;
  /** Injectable for tests; defaults to the platform `fetch`. */
  fetch?: typeof fetch;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  baseDelayMs?: number;
  /** Injectable jitter for deterministic tests; defaults to Math.random. */
  random?: () => number;
}

export class HttpTransport implements Transport {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #maxRetries: number;
  readonly #baseDelayMs: number;
  readonly #random: () => number;

  constructor(options: HttpTransportOptions) {
    this.#apiKey = options.apiKey;
    this.#baseUrl = options.apiBaseUrl.replace(/\/+$/, '');
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.#random = options.random ?? Math.random;
  }

  /* ── Catalog (the real, documented paths — docs/04 §1, §2.4) ── */

  async getChannel(): Promise<ChannelInfo> {
    const c = await this.#getJson<ChannelWire>('/v1/channel');
    return {
      id: c.id,
      name: c.name,
      mode: c.mode,
      keyClass: c.key_class,
      permissions: c.permissions,
    };
  }

  async listProducts(params?: PageParamsWire): Promise<Page<Product>> {
    const page = await this.#getJson<CatalogPageWire<VariantWire>>(
      '/v1/catalog/variants' + toQuery(params),
    );
    const familyById = await this.#families();
    return toPage(page, (v) => this.#joinProduct(v, familyById));
  }

  async getProduct(sku: string): Promise<Product> {
    const page = await this.#getJson<CatalogPageWire<VariantWire>>(
      '/v1/catalog/variants' + toQuery(FULL_PAGE),
    );
    const variant = page.data.find((v) => v.sku === sku);
    if (!variant) {
      throw new TreatinkError('not_found', 'No product matches that SKU.', {
        status: 404,
        param: 'sku',
      });
    }
    const familyById = await this.#families();
    return this.#joinProduct(variant, familyById);
  }

  /* ── Templates (P4-T03): live cutout-labels ARE the templates (docs/04 §2.5). ── */

  async listTemplates(params: { sku: string } & PageParamsWire): Promise<Page<Template>> {
    // The live catalog serves cutout-labels globally — there is no per-SKU filter on the wire;
    // `sku` is accepted for Transport parity (fixtures behave the same, docs/04 §2.5).
    const page = await this.#getJson<CatalogPageWire<CutoutLabelWire>>(
      '/v1/catalog/cutout-labels' +
        toQuery({
          ...(params.limit !== undefined ? { limit: params.limit } : {}),
          ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
        }),
    );
    return toPage(page, toTemplate);
  }

  /* ── Assets (P4-T02): the real two-step flow — declare → PUT → finalize (docs/08 §6). ── */

  async declareAsset(input: {
    role: AssetRole;
    contentType: string;
    sizeBytes: number;
    sha256: string;
  }): Promise<PendingAsset> {
    const wire = await this.#postJson<ArtworkPendingWire>('/v1/assets', {
      role: input.role,
      content_type: input.contentType,
      size_bytes: input.sizeBytes,
      sha256: input.sha256,
    });
    return {
      id: wire.id,
      role: wire.role,
      status: 'pending',
      pendingExpiresAt: wire.pending_expires_at,
      upload: {
        method: 'PUT',
        url: wire.upload.url,
        headers: wire.upload.headers,
        expiresAt: wire.upload.expires_at,
      },
    };
  }

  async putAssetBytes(upload: UploadAuthorization, file: Blob): Promise<void> {
    // Direct browser → object storage with exactly the presigned headers. NOT the API host — no
    // Authorization, no envelope; failures surface as SDK-local upload_failed (docs/08 §6b).
    let response: Response;
    try {
      response = await this.#fetch(upload.url, {
        method: 'PUT',
        headers: upload.headers,
        body: file,
      });
    } catch (cause) {
      throw new TreatinkError('upload_failed', 'The upload could not reach storage.', { cause });
    }
    if (!response.ok) {
      throw new TreatinkError(
        'upload_failed',
        `The storage upload failed (HTTP ${response.status}).`,
        {
          status: response.status,
        },
      );
    }
  }

  async finalizeAsset(assetId: string): Promise<Asset> {
    // Finalize REQUIRES an empty body (personalization_media require_empty_body) — no payload,
    // no Content-Type.
    const wire = await this.#postJson<ArtworkFinalWire>(
      `/v1/assets/${encodeURIComponent(assetId)}/finalize`,
      null,
    );
    return {
      id: wire.id,
      role: wire.role,
      status: 'final',
      contentType: wire.content_type,
      width: wire.width,
      height: wire.height,
      sha256: wire.sha256,
    };
  }

  /* ── Internals ── */

  async #families(): Promise<Map<string, ProductWire>> {
    const page = await this.#getJson<CatalogPageWire<ProductWire>>(
      '/v1/catalog/products' + toQuery(FULL_PAGE),
    );
    return new Map(page.data.map((p) => [p.id, p]));
  }

  #joinProduct(variant: VariantWire, familyById: Map<string, ProductWire>): Product {
    const family = familyById.get(variant.product_id);
    if (!family) {
      throw new TreatinkError('not_found', 'No product family for that variant.', {
        status: 404,
        param: 'product_id',
      });
    }
    return toProduct(variant, family);
  }

  /** Idempotent GET with envelope→error mapping and bounded backoff+jitter on transient failures. */
  async #getJson<T>(path: string): Promise<T> {
    const url = `${this.#baseUrl}${path}`;
    const init: RequestInit = {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.#apiKey}` }, // NO channel header (docs/04 §2.8)
    };
    for (let attempt = 0; ; attempt++) {
      let response: Response;
      try {
        response = await this.#fetch(url, init);
      } catch (cause) {
        if (attempt < this.#maxRetries) {
          await this.#backoff(attempt);
          continue;
        }
        throw new TreatinkError('service_unavailable', 'The request could not reach the API.', {
          cause,
        });
      }
      if (response.ok) {
        return (await response.json()) as T;
      }
      const error = await this.#toError(response);
      if (attempt < this.#maxRetries && RETRYABLE_STATUS.has(response.status)) {
        await this.#backoff(attempt);
        continue;
      }
      throw error;
    }
  }

  /** POST with envelope→error mapping. NOT retried (declare/finalize create/advance state;
   *  finalize is idempotent server-side, but the caller owns retry policy). `body: null` sends an
   *  EMPTY body with no Content-Type (finalize requires it). */
  async #postJson<T>(path: string, body: Record<string, unknown> | null): Promise<T> {
    const url = `${this.#baseUrl}${path}`;
    let response: Response;
    try {
      response = await this.#fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.#apiKey}`, // NO channel header (docs/04 §2.8)
          ...(body !== null ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== null ? { body: JSON.stringify(body) } : {}),
      });
    } catch (cause) {
      throw new TreatinkError('service_unavailable', 'The request could not reach the API.', {
        cause,
      });
    }
    if (response.ok) {
      return (await response.json()) as T;
    }
    throw await this.#toError(response);
  }

  async #toError(response: Response): Promise<TreatinkError> {
    const body: unknown = await response.json().catch(() => null);
    if (body && typeof body === 'object' && 'error' in body) {
      return fromEnvelope(response.status, body as ApiErrorEnvelope);
    }
    return new TreatinkError('bad_request', `Treatink API error (HTTP ${response.status})`, {
      status: response.status,
    });
  }

  #backoff(attempt: number): Promise<void> {
    // full jitter: random point in [0, base · 2^attempt] (AWS "Exponential Backoff And Jitter").
    const ceiling = this.#baseDelayMs * 2 ** attempt;
    return this.#sleep(Math.round(this.#random() * ceiling));
  }
}

function toQuery(params?: PageParamsWire): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.limit !== undefined) q.set('limit', String(params.limit));
  if (params.cursor !== undefined) q.set('cursor', params.cursor);
  const s = q.toString();
  return s ? `?${s}` : '';
}
