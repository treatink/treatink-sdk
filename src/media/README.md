# media/

Ingest helpers for the designer. Both are **lazy** where heavy.

- `heic.ts` — HEIC/HEIF → JPEG transcode via `heic2any`, loaded as its **own lazy chunk** only on
  first HEIC (Charter §16.9, budget-exempt). P2-T06.
- `exif.ts` — EXIF orientation correction on ingest (via `exifr`). The store does none; this is an
  SDK addition (docs/05 §10). P2-T05.

No third-party network requests (docs/11 §2) — libraries are bundled, not fetched.
