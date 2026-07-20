/**
 * The cutout engine — PURE, DOM-free (docs/01 §6, docs/02 §7). Canvas is injected at the edges; the
 * lint boundary forbids window/document here. Ported from the treatink store code (docs/05), NOT
 * Charter Appendix D. This is the WYSIWYG core: same inputs → same 900×1200 composite in browser and
 * (later) on the server.
 *
 * Implemented by: P1-T09 (geometry/transform), P1-T10 (render/text/export).
 */
export * from './types.js';
export * from './geometry.js';
export * from './transform.js';

// Added by P1-T10:
//   renderComposite                          (render.ts,   docs/05 §6)
//   placePersonalizationText                 (text.ts,     docs/05 §7)
//   exportArtifacts                          (export.ts,   docs/05 §8)  → { print, display, source, lowRes }
