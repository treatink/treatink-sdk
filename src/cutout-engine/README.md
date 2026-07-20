# cutout-engine/

The WYSIWYG core. **PURE and DOM-free** — no `window`/`document`; the canvas is injected (a browser
`Canvas` or `@napi-rs/canvas` in Node). The lint boundary (`eslint.config.js`) enforces this. Ported
from the **treatink store code** (docs/05), not Appendix D.

| File | Responsibility | Task |
|---|---|---|
| `types.ts` | constants (900×1200, coverage 1.3, MIN_SCALE 0.5), `EditorImage`, injected `CanvasLike` | done (skeleton) |
| `geometry.ts` | initial fit (docs/05 §3), pan (freeform, §4), zoom clamp `[0.5,maxScale]` (§5) | P1-T09 |
| `transform.ts` | `{x,y,scale,rotation}` semantics in canvas space (§2, §8.2) | P1-T09 |
| `render.ts` | compositing: bg → photo(center-scale) → cutout PNG on top → text (§6) | P1-T10 |
| `text.ts` | personalization text placement — offsets `160/130/100/320`, Mitr auto-fit (§7) | P1-T10 |
| `export.ts` | print + display(mockup+zone) + source artifacts + `lowRes` (§8, §8.1) | P1-T10 |

Correctness is defined by golden tests (docs/06 §3) whose baselines are produced by the store's own
render code run headless — not by this engine. Port numbers **verbatim** from the cited store lines;
never invent a constant.
