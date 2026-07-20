import { TreatinkError } from '../types.js';

/**
 * Photo ingest with EXIF orientation correction (Charter §7.2; SDK addition per docs/05 §10).
 *
 * Every target browser (evergreen Chrome/Edge/Firefox, Safari ≥ 16 — Charter §13) applies EXIF
 * orientation natively when decoding via <img> (CSS `image-orientation: from-image` default), so
 * naturalWidth/naturalHeight and drawImage output are already upright. We therefore ingest through
 * the platform pipeline rather than re-rotating (which would double-apply); `exifr` stays unused
 * for MVP orientation.
 */

/** Store guard semantics (useFileHandlers.js:19): images only, SVG rejected. */
export function assertIngestableImage(file: Blob & { type: string }): void {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new TreatinkError(
      'unsupported_file_type',
      `Unsupported file type '${file.type || 'unknown'}' — choose a photo (PNG, JPEG, or HEIC).`,
      { param: 'file' },
    );
  }
}

/** Client-side cap, mapped to the API's code/status (docs/02 §4). */
export const MAX_INGEST_BYTES = 25_000_000;

export function assertIngestableSize(file: Blob): void {
  if (file.size > MAX_INGEST_BYTES) {
    throw new TreatinkError('upload_too_large', 'Photos can be at most 25 MB.', {
      status: 413,
      param: 'file',
    });
  }
}

export interface LoadedPhoto {
  /** Drawable, already EXIF-upright. */
  image: HTMLImageElement;
  /** Post-orientation dimensions. */
  naturalWidth: number;
  naturalHeight: number;
  /** Object URL backing the <img>; revoke when the photo is replaced/discarded. */
  objectUrl: string;
  /** The untouched original file (becomes the `source` asset at save time). */
  file: Blob;
}

/** Decode a validated file into an upright drawable. */
export async function loadOrientedPhoto(file: Blob & { type: string }): Promise<LoadedPhoto> {
  assertIngestableImage(file);
  assertIngestableSize(file);
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.src = objectUrl;
  try {
    await image.decode();
  } catch (cause) {
    URL.revokeObjectURL(objectUrl);
    throw new TreatinkError('unsupported_file_type', 'This image could not be read.', {
      param: 'file',
      cause,
    });
  }
  return {
    image,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    objectUrl,
    file,
  };
}
