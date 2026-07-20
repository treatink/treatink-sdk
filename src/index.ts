/**
 * Public browser entry. Exposes the `Treatink` global (via the CDN build) and the ESM named export.
 * NO secret-key code path may exist in this build graph (enforced by scripts/check-no-secret.mjs).
 *
 * Assembly of the `tk` instance (wiring config → transport → namespaces → designer) is P1-T04+.
 */
import { createArtworkApi } from './api/artwork.js';
import { createProductsApi } from './api/products.js';
import { createTemplatesApi } from './api/templates.js';
import { resolveConfig } from './config.js';
import { FixtureTransport, type FixtureOp } from './transport/fixture-transport.js';
import { TreatinkError } from './types.js';
import type { Treatink as TreatinkInstance, TreatinkConfig } from './types.js';

/** Stub namespace factory — every method throws until its task fills it (P1-T06+). */
function notImplemented(area: string): never {
  throw new TreatinkError('not_implemented', `${area}: not implemented yet in this build`);
}

export type {
  TreatinkConfig,
  ThemeConfig,
  CopyStrings,
  ProductsApi,
  TemplatesApi,
  ArtworkApi,
  DesignerApi,
  DraftsApi,
  OrdersApi,
  FixturesApi,
  DesignerOptions,
  DesignerResult,
  DraftRecord,
  Product,
  Template,
  Asset,
  Transform,
  LabelZone,
  OpeningGeometry,
  RectWithCount,
  ShippingAddress,
  BuildPayloadInput,
  OrderPayload,
  TreatinkEvent,
  AssetRole,
  PetNamePosition,
  Page,
} from './types.js';
export { TreatinkError } from './types.js';

/** The instance interface (docs/10 §2), merged with the `Treatink` entry value below. */
export type Treatink = TreatinkInstance;

export const Treatink = {
  /** Create an SDK instance. Throws key_scope_violation for non-publishable keys (docs/11 §1). */
  init(config: TreatinkConfig): TreatinkInstance {
    const resolved = resolveConfig(config);
    // The one backend seam (docs/01 §4). HttpTransport arrives in P4-T01.
    const fixtureTransport = resolved.mode === 'fixtures' ? new FixtureTransport() : null;
    // Namespaces are wired by their tasks (api P1-T08, events P1-T12,
    // designer P2, drafts P3); until then each stub throws not_implemented on use.
    const tk: TreatinkInstance = {
      // Live-mode transport is HttpTransport (P4-T01); until then live namespaces stay stubs.
      products: fixtureTransport
        ? createProductsApi(fixtureTransport)
        : {
            list: () => notImplemented('products.list (live: P4-T01)'),
            get: () => notImplemented('products.get (live: P4-T01)'),
          },
      templates: fixtureTransport
        ? createTemplatesApi(fixtureTransport)
        : { list: () => notImplemented('templates.list (live: P4-T01)') },
      artwork: fixtureTransport
        ? createArtworkApi(fixtureTransport)
        : { upload: () => notImplemented('artwork.upload (live: P4-T01)') },
      designer: {
        open: () => notImplemented('designer.open (P2-T01)'),
        close: () => notImplemented('designer.close (P2-T01)'),
      },
      drafts: {
        list: () => notImplemented('drafts.list (P3-T03)'),
        get: () => notImplemented('drafts.get (P3-T03)'),
        delete: () => notImplemented('drafts.delete (P3-T03)'),
        clear: () => notImplemented('drafts.clear (P3-T03)'),
      },
      orders: { buildPayload: () => notImplemented('orders.buildPayload (P3-T05)') },
      on: () => notImplemented('on (P1-T12)'),
      ...(fixtureTransport
        ? {
            fixtures: {
              failNext: (op: string, error: { status: number; code: string }) =>
                fixtureTransport.failNext(op as FixtureOp, error),
              setLatency: (ms: number) => fixtureTransport.setLatency(ms),
            },
          }
        : {}),
    };
    return tk;
  },
};

export default Treatink;
