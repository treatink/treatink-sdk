/**
 * The injected stylesheet (docs/01 §8): light DOM, one sheet, scoped reset under the tk- root.
 * P2-T01 ships the structural shell; P2-T04 adds the full theme (`--tk-*` vars from ThemeConfig).
 * tk- class names are the documented theming contract (docs/02 §3) — renaming is breaking.
 */

export const STYLES_ELEMENT_ID = 'tk-styles';

/** Mobile breakpoint: below this the two-column layout stacks into a full-screen sheet. */
export const MOBILE_BREAKPOINT_PX = 768;

export const STYLESHEET = `
.tk-overlay, .tk-overlay * { margin: 0; padding: 0; box-sizing: border-box; }
.tk-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--tk-z-index, 2147483000);
  background: var(--tk-overlay-color, rgba(0, 0, 0, 0.55));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--tk-font-family, 'Montserrat', system-ui, sans-serif);
}
.tk-modal {
  background: var(--tk-surface, #ffffff);
  border-radius: var(--tk-border-radius, 15px);
  width: min(960px, 94vw);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tk-header {
  background: var(--tk-header-background, #f26b1d);
  color: var(--tk-header-text, #ffffff);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
}
/* 24px = WCAG "large text" — the default white-on-#f26b1d header passes at the 3:1 threshold. */
.tk-title { font-size: 24px; font-weight: 600; }
.tk-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 8px;
}
.tk-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
.tk-body {
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding: 16px;
  overflow: auto;
  flex: 1;
}
.tk-preview { flex: 3; min-width: 0; }
.tk-controls { flex: 2; min-width: 0; }
@media (max-width: ${MOBILE_BREAKPOINT_PX - 1}px) {
  .tk-modal { width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0; }
  .tk-body { flex-direction: column; }
}
`;

/** Inject the sheet once per document. */
export function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLES_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLES_ELEMENT_ID;
  style.textContent = STYLESHEET;
  doc.head.appendChild(style);
}
