import { TreatinkError } from '../types.js';
import type { ArtworkApi } from '../types.js';
import type { Transport } from '../transport/transport.js';

/**
 * tk.artwork.upload — the two-step asset flow (docs/04 §2.3, docs/08 §6): client-side validation,
 * then declare → PUT bytes → finalize through the transport. Non-idempotent: NO blind retry; a
 * failed browser PUT surfaces `upload_failed` to the caller (docs/02 §5).
 */

/** Stricter client-side cap (docs/04 §2.3); the wire itself allows 50 MB. */
export const MAX_UPLOAD_BYTES = 25_000_000;
/** PNG/JPEG only (Charter §6.2); HEIC is transcoded by media/ BEFORE upload (P2-T06). */
export const UPLOAD_CONTENT_TYPES = ['image/png', 'image/jpeg'];

export function createArtworkApi(transport: Transport): ArtworkApi {
  return {
    async upload(input) {
      const { role, file } = input;
      // Both checks run BEFORE any declare call — nothing leaves the client for invalid files.
      if (!UPLOAD_CONTENT_TYPES.includes(file.type)) {
        throw new TreatinkError(
          'unsupported_file_type',
          `Unsupported file type '${file.type || 'unknown'}' — upload PNG or JPEG.`,
          { param: 'file' },
        );
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new TreatinkError(
          'upload_too_large',
          'The upload exceeds the allowed size (25 MB).',
          {
            status: 413,
            param: 'file',
          },
        );
      }
      const sha256 = input.sha256 ?? (await sha256Hex(file));
      const pending = await transport.declareAsset({
        role,
        contentType: file.type,
        sizeBytes: file.size,
        sha256,
      });
      await transport.putAssetBytes(pending.upload, file);
      return transport.finalizeAsset(pending.id);
    },
  };
}

/** WebCrypto digest (browser + Node ≥ 18); the client computes sha256 before declare (docs/08 §6a). */
async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
