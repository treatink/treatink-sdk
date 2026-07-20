/**
 * Public browser entry. Exposes the `Treatink` global (via the CDN build) and the ESM named export.
 * NO secret-key code path may exist in this build graph (enforced by scripts/check-no-secret.mjs).
 *
 * Assembly of the `tk` instance (wiring config → transport → namespaces → designer) is P1-T04+.
 */
import { createArtworkApi } from './api/artwork.js';
import { createOrdersApi } from './api/orders.js';
import { createProductsApi } from './api/products.js';
import { createTemplatesApi } from './api/templates.js';
import { resolveConfig } from './config.js';
import { DraftsStore } from './drafts/store.js';
import { createEventBus, instrumentNamespace } from './events.js';
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
    const bus = createEventBus();
    // Every TreatinkError surfacing from a public namespace also fires 'error' (docs/10 §2).
    const onError = (error: TreatinkError) => bus.emit('error', error);
    const guard = <T extends object>(api: T): T => instrumentNamespace(api, onError);
    // Reference-only drafts (docs/10 §6); falls back to in-memory outside the browser.
    const draftsStore = new DraftsStore({ channel: resolved.channel });
    // Namespaces are wired by their tasks (api P1-T08, events P1-T12,
    // designer P2, drafts P3); until then each stub throws not_implemented on use.
    const tk: TreatinkInstance = {
      // Live-mode transport is HttpTransport (P4-T01); until then live namespaces stay stubs.
      products: guard(
        fixtureTransport
          ? createProductsApi(fixtureTransport)
          : {
              list: () => notImplemented('products.list (live: P4-T01)'),
              get: () => notImplemented('products.get (live: P4-T01)'),
            },
      ),
      templates: guard(
        fixtureTransport
          ? createTemplatesApi(fixtureTransport)
          : { list: () => notImplemented('templates.list (live: P4-T01)') },
      ),
      artwork: guard(
        fixtureTransport
          ? createArtworkApi(fixtureTransport)
          : { upload: () => notImplemented('artwork.upload (live: P4-T01)') },
      ),
      // The designer is a LAZY chunk — pulled on first open() to keep the loader tiny (docs/06 §2).
      designer: {
        open: (options) => {
          void import('./designer/designer.js')
            .then((m) =>
              m.openDesigner(
                {
                  copy: resolved.copy,
                  theme: resolved.theme,
                  emit: (event, payload) => bus.emit(event, payload),
                  maxPersonalizationLength: resolved.maxPersonalizationLength,
                  listTemplates: (params) =>
                    fixtureTransport
                      ? fixtureTransport.listTemplates(params)
                      : Promise.reject(
                          new TreatinkError('bad_request', 'live templates arrive with P4-T01'),
                        ),
                  getProduct: (sku) =>
                    fixtureTransport
                      ? fixtureTransport.getProduct(sku)
                      : Promise.reject(
                          new TreatinkError('bad_request', 'live catalog arrives with P4-T01'),
                        ),
                  uploadArtwork: (input) =>
                    fixtureTransport
                      ? createArtworkApi(fixtureTransport).upload(input)
                      : Promise.reject(
                          new TreatinkError('bad_request', 'live uploads arrive with P4-T01'),
                        ),
                  // Written ONLY after a successful save; emits draft:saved (docs/10 §2).
                  saveDraft: (result) => {
                    const now = new Date().toISOString();
                    draftsStore.put({
                      draftId: result.draftId,
                      createdAt: now,
                      updatedAt: now,
                      channel: resolved.channel,
                      product: {
                        sku: result.sku,
                        ...(result.variantId ? { variantId: result.variantId } : {}),
                      },
                      cutout: {
                        cutoutLabelId: result.cutoutLabelId,
                        ...(result.petNamePosition
                          ? { petNamePosition: result.petNamePosition }
                          : {}),
                      },
                      personalizationText: result.personalizationText ?? null,
                      transform: result.transform,
                      labelZone: result.labelZone,
                      artwork: result.artwork,
                      status: 'completed',
                    });
                    bus.emit('draft:saved', { draftId: result.draftId, sku: result.sku });
                  },
                  getDraft: (draftId) => draftsStore.get(draftId),
                },
                options,
              ),
            )
            .catch((error: unknown) => {
              const wrapped =
                error instanceof TreatinkError
                  ? error
                  : new TreatinkError('bad_request', 'designer failed to load', { cause: error });
              options.onError?.(wrapped);
              bus.emit('error', wrapped);
            });
        },
        close: () => {
          void import('./designer/designer.js').then((m) => m.closeDesigner());
        },
      },
      drafts: guard({
        list: () => draftsStore.list(),
        get: (draftId: string) => draftsStore.get(draftId),
        delete: (draftId: string) => draftsStore.delete(draftId),
        clear: () => draftsStore.clear(),
      }),
      orders: guard(createOrdersApi((draftId) => draftsStore.get(draftId))),
      on: (event, handler) => bus.on(event, handler),
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
