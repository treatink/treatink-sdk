import { exportArtifacts, toPersistedTransform } from '../cutout-engine/index.js';
import type { EditorImage, EngineEnv } from '../cutout-engine/index.js';
import type { TextOptions } from '../cutout-engine/text.js';
import type { Asset, AssetRole, DesignerResult, Product, Template } from '../types.js';

/**
 * Upload-on-save (P3-T01, Charter §8.4) — ASSET-based, no sessions (GP-07/GP-18):
 *   1. engine export → print (900×1200) + display + source artifacts (docs/05 §8);
 *   2. upload `source` (the ingested photo) then `rendered` (the print composite) — each runs
 *      declare→PUT→finalize through the transport with client-side sha256 (docs/08 §6);
 *   3. previewUrl = LOCAL object URL of the display composite (GP-08 — a pk key cannot read the
 *      asset back);
 *   4. return the complete DesignerResult (docs/10 §4).
 * Failure at any step propagates unchanged — the Save UI owns retry (P3-T02); nothing persists
 * for an abandoned design (drafts are written by the caller only after this resolves, P3-T03).
 */

export interface SavePipelineInput {
  env: EngineEnv;
  sku: string;
  editor: EditorImage;
  photo: { drawable: unknown; naturalWidth: number; naturalHeight: number; file: Blob };
  cutout: { template: Template; drawable: unknown };
  text: TextOptions | null;
  product: Product | null;
  mockup: { drawable: unknown; width: number; height: number } | null;
  upload: (input: { role: AssetRole; file: Blob }) => Promise<Asset>;
}

export async function runSavePipeline(input: SavePipelineInput): Promise<DesignerResult> {
  const { editor, photo, cutout, product } = input;

  const artifacts = await exportArtifacts({
    env: input.env,
    image: editor,
    photo: photo.drawable,
    photoNatural: { width: photo.naturalWidth, height: photo.naturalHeight },
    cutout: cutout.drawable,
    text: input.text,
    source: photo.file,
    mockup: input.mockup,
    labelZone: product?.labelZone ?? null,
  });

  // Two-asset upload (docs/04 §2.3): source = the ingested photo (HEIC already transcoded to
  // JPEG at ingest), rendered = the print composite. Sequential — no blind retry (docs/02 §5).
  const sourceAsset = await input.upload({ role: 'source', file: artifacts.source });
  const renderedAsset = await input.upload({ role: 'rendered', file: artifacts.print });

  return {
    draftId: crypto.randomUUID(), // UUID v4 — also the idempotency token (docs/10 §4)
    sku: input.sku,
    ...(product ? { variantId: product.variantId } : {}),
    cutoutLabelId: cutout.template.cutoutLabelId,
    personalizationText: input.text?.text ?? null,
    petNamePosition: cutout.template.petNamePosition,
    previewUrl: URL.createObjectURL(artifacts.display),
    artwork: { sourceAssetId: sourceAsset.id, renderedAssetId: renderedAsset.id },
    transform: toPersistedTransform(editor),
    // Interpreting context for the display composite; full-canvas for no-zone products.
    labelZone: product?.labelZone ?? { x: 0, y: 0, width: 1, height: 1 },
    lowRes: artifacts.lowRes,
  };
}
