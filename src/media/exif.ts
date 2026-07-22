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

/**
 * The backend's artwork allowlist (treatink-api personalization_media/service.py): assets may be
 * `image/png` or `image/jpeg` ONLY. HEIC/HEIF is accepted at ingest because the SDK transcodes it
 * to JPEG before it ever reaches the wire (media/heic.ts). Everything else — webp, gif, svg… —
 * would pass a local canvas but 415 at declare, so it is rejected up front (owner 2026-07-22).
 */
export const WIRE_CONTENT_TYPES = ['image/png', 'image/jpeg'] as const;

export function assertIngestableImage(file: Blob & { type: string }): void {
  if (!(WIRE_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    throw new TreatinkError(
      'unsupported_file_type',
      `Unsupported file type '${file.type || 'unknown'}' — choose a PNG, JPEG, or HEIC photo.`,
      { param: 'file' },
    );
  }
}

/** Client-side cap, stricter than the API's 50 MB (docs/04 §2.3), mapped to its code/status. */
export const MAX_INGEST_BYTES = 25_000_000;
/** Backend decode bounds (service.py ARTWORK_MAX_DIMENSION / ARTWORK_MAX_PIXELS) — enforced
 *  client-side so the shopper hears it at ingest, not at save. */
export const MAX_INGEST_DIMENSION = 12_000;
export const MAX_INGEST_PIXELS = 50_000_000;

export function assertIngestableSize(file: Blob): void {
  if (file.size > MAX_INGEST_BYTES) {
    throw new TreatinkError('upload_too_large', 'Photos can be at most 25 MB.', {
      status: 413,
      param: 'file',
    });
  }
}

export function assertIngestableDimensions(width: number, height: number): void {
  if (width > MAX_INGEST_DIMENSION || height > MAX_INGEST_DIMENSION) {
    throw new TreatinkError(
      'upload_validation_failed',
      `Photos can be at most ${MAX_INGEST_DIMENSION.toLocaleString('en-US')} px per side.`,
      { param: 'file' },
    );
  }
  if (width * height > MAX_INGEST_PIXELS) {
    throw new TreatinkError(
      'upload_validation_failed',
      'This photo has too many pixels (max 50 megapixels).',
      { param: 'file' },
    );
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
  try {
    // Backend decode bounds, checked at ingest (post-orientation dimensions).
    assertIngestableDimensions(image.naturalWidth, image.naturalHeight);
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
  return {
    image,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    objectUrl,
    file,
  };
}
