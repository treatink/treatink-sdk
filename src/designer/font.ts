/**
 * On-label font (Mitr 400): bundled, never fetched from a third party (Charter §10.2). The base64
 * payload lives in its own lazy chunk; loading resolves BEFORE the first text measurement so the
 * auto-fit is deterministic (docs/05 §7 caveat — the store measured pre-load; we fix that).
 */

let loading: Promise<void> | null = null;

export function ensureLabelFont(doc: Document): Promise<void> {
  loading ??= (async () => {
    const { MITR_REGULAR_BASE64 } = await import('./font-data.js'); // ← lazy font chunk
    const face = new FontFace('Mitr', `url(data:font/ttf;base64,${MITR_REGULAR_BASE64})`, {
      weight: '400',
    });
    await face.load();
    doc.fonts.add(face);
  })();
  return loading;
}
