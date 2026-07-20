/**
 * Public browser entry. Exposes the `Treatink` global (via the CDN build) and the ESM named export.
 * NO secret-key code path may exist in this build graph (enforced by scripts/check-no-secret.mjs).
 *
 * Assembly of the `tk` instance (wiring config → transport → namespaces → designer) is P1-T04+.
 */
import { assertPublishableKey } from './config.js';
import { TreatinkError } from './types.js';
import type { Treatink, TreatinkConfig } from './types.js';

export type {
  Treatink,
  TreatinkConfig,
  ThemeConfig,
  CopyStrings,
  DesignerOptions,
  DesignerResult,
  DraftRecord,
  Product,
  Template,
  Asset,
  Transform,
  LabelZone,
  BuildPayloadInput,
  OrderPayload,
  TreatinkEvent,
  AssetRole,
  PetNamePosition,
  Page,
} from './types.js';
export { TreatinkError } from './types.js';

export const Treatink = {
  /** Create an SDK instance. Throws key_scope_violation for non-publishable keys (docs/11 §1). */
  init(config: TreatinkConfig): Treatink {
    assertPublishableKey(config.apiKey);
    // P1-T04+: resolveConfig → build transport (fixtures|http) → namespaces → designer → event bus.
    throw new TreatinkError('not_implemented', 'Treatink.init: assembled from P1-T04 onward');
  },
};

export default Treatink;
