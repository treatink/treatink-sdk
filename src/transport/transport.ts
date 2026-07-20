import type { Asset, AssetRole, Page, Product, Template } from '../types.js';

/** Internal pagination params (public surface inlines these per docs/10 §3). */
export interface PageParams {
  limit?: number;
  cursor?: string;
}

/**
 * The single seam between the SDK and any backend (docs/01 §4). Two implementations:
 * HttpTransport (live) and FixtureTransport (bundled simulation). Nothing above the transport knows
 * which is active — swapping `mode` swaps the implementation. API namespaces call the transport;
 * they never call fetch directly (docs/02 §5).
 *
 * Implementations normalize wire shapes (docs/08) via catalog/adapter before returning public types.
 * Implemented by: P1-T06 (fixture), P4-T01/T02 (http).
 */
export interface Transport {
  getChannel(): Promise<ChannelInfo>;

  listProducts(params?: PageParams): Promise<Page<Product>>;
  getProduct(sku: string): Promise<Product>;
  listTemplates(params: { sku: string } & PageParams): Promise<Page<Template>>;

  /** Step 1: declare an asset → get a presigned upload authorization. */
  declareAsset(input: {
    role: AssetRole;
    contentType: string;
    sizeBytes: number;
    sha256: string;
  }): Promise<PendingAsset>;
  /** Step 2: PUT the raw bytes to the presigned URL (no-op in fixtures). Surfaces upload_failed. */
  putAssetBytes(upload: UploadAuthorization, file: Blob): Promise<void>;
  /** Step 3: finalize → the immutable final asset (no URL is returned by the API; docs/04 §2.3). */
  finalizeAsset(assetId: string): Promise<Asset>;
}

export interface ChannelInfo {
  id: string;
  name: string;
  mode: 'test' | 'live';
  keyClass: 'publishable' | 'secret';
  permissions: readonly string[];
}

export interface UploadAuthorization {
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface PendingAsset {
  id: string;
  role: AssetRole;
  status: 'pending';
  upload: UploadAuthorization;
  pendingExpiresAt: string;
}
