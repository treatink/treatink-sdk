# designer/

The modal personalizer (Charter §7, docs/design-reference). **Light DOM**, `tk-`-prefixed classes,
one injected stylesheet with a scoped reset (docs/01 §8). Loads as a **lazy chunk** on first
`open()` to keep the loader ≤15 KB gz. All user/catalog text via `textContent`, never `innerHTML`
(docs/11 §3).

| File | Responsibility | Task |
|---|---|---|
| `designer.ts` | `open`/`close`, lifecycle, single-instance guard, emits `designer:open/close` | P2-T01 |
| `modal.ts` | portal root, header, scroll-lock, focus trap + restore, Escape, a11y (`role=dialog`) | P2-T01/T03 |
| `controls/` | upload (drag+picker, EXIF), zoom (slider min 0.5), category chips + Browse All, text toggle, low-res, Save | P2-T05…T11 |
| `theme.ts` | `ThemeConfig` → `--tk-*` CSS vars (defaults docs/design-reference §3) | P2-T04 |
| `copy.ts` | `CopyStrings` defaults + overrides | P2-T04 |
| `styles.css` | the one injected sheet (scoped reset + `tk-` styles) | P2-T04 |

Drives the pure `cutout-engine` for preview/export and the `save` pipeline on Save. The designer owns
UI only — no network (that's the transport via `save`).
