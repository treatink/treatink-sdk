import { TreatinkError } from '../types.js';

/**
 * HEIC/HEIF → JPEG transcode (Charter §16.9, P2-T06). The decoder (`heic2any`) loads as its OWN
 * lazy chunk on first HEIC ingest — never in the loader or designer chunk (docs/06 §2; the HEIC
 * chunk is budget-exempt). Transcode always runs for HEIC (even where Safari could display it)
 * so the pipeline — preview, engine, save-time JPEG upload — sees one deterministic format.
 */

/** Some platforms hand over HEIC files with an empty MIME type — check the extension too. */
export function isHeic(file: Blob & { type: string; name?: string }): boolean {
  if (file.type === 'image/heic' || file.type === 'image/heif') return true;
  const name = file.name?.toLowerCase() ?? '';
  return file.type === '' && (name.endsWith('.heic') || name.endsWith('.heif'));
}

export async function transcodeHeicToJpeg(file: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any'); // ← the lazy decoder chunk
  try {
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    return Array.isArray(result) ? result[0]! : result;
  } catch (cause) {
    throw new TreatinkError('unsupported_file_type', 'This HEIC photo could not be read.', {
      param: 'file',
      cause,
    });
  }
}
