# Design & Parity Reference

**Default look and behavior = the current `treatink.com` customizer** (in the workspace at
`../treatink/web/src/components/customizer/…`). Owner decision (2026-07-20): *no separate Riley's
reference is needed — default styling is the same as the current website.* This doc is the Phase-2
visual/behavioral source of truth; it replaces any external screenshot capture.

## 1. There is only one customizer — the SDK productizes it natively

The "Riley's designer" is **not** separate software. Riley's (Shopify) embeds the treatink.com
customizer in an **iframe**, in "API mode", via a URL like:

```
https://treatink.com/customizer?apiMode=true&uuid=<session>&platform=shopify
    &productId=8709961449643&hostname=rileyspets.com&petTypes=dog&fresh=1
```

The iframe wrapper (`APICustomizerWrapper.jsx`) then fetches the session
(`api.treatink.com/functions/v1/get-personalization-session/{uuid}`), loads product data,
pre-populates, renders `PetCustomizer apiMode`, saves via `upload-customization-artwork`, and talks
to the host through `postMessage` (`treatink_close_modal`).

**The SDK replaces this entire iframe + URL-param + postMessage handshake with an in-page native
modal** driven by `Treatink.init()` + `tk.designer.open()`. Same UI, same math, no iframe.

## 2. Current-integration → SDK mapping (the migration contract)

| Today (iframe API mode) | SDK equivalent |
|---|---|
| iframe at `treatink.com/customizer?apiMode=true…` | native modal, `tk.designer.open()` (`docs/01` §8) |
| `hostname=rileyspets.com` (URL param) | `Treatink.init({ channel: 'rileyspets.com' })` |
| `productId` / `SKU` | `tk.designer.open({ sku })` (SKU resolves to a `var_…`, `docs/04` §2.4) |
| `uuid` (server session) + `get-personalization-session` | **gone** — asset-based; SDK creates a local draft + `ast_` assets (GP-18) |
| `platform=shopify` | not needed — SDK is platform-agnostic; the Shopify app wraps it |
| `petTypes=dog` (subject) | **deprecated** — subject/`animal_type` selection is deferred (Charter §2/§12) |
| `postMessage(treatink_close_modal)` | direct callbacks: `onComplete` / `onClose` (Charter §6.3) |
| `upload-customization-artwork` (multipart w/ sessionUuid) | two-step asset upload (`docs/04` §2.3) |

Phase-2 "Riley's parity" = reproduce `PetCustomizer` (desktop + mobile) as this native modal, with
the store's feature set and the engine math from `docs/05`.

## 3. Default theme (extracted from the store; GP-17)

Use the Charter §7.3 defaults, which match the store's palette family (the store spinner uses
`#EA8000` orange + `#e2e6ff` light periwinkle — same family):

| Token | Default | Source |
|---|---|---|
| `--tk-primary` | `#8EA0F6` (periwinkle) | Charter §7.3 / store secondary `#e2e6ff` |
| `--tk-accent` | `#EA8D00` (orange) | Charter §7.3 / store `#EA8000` |
| `--tk-header-background` | `#F26B1D` | Charter §7.3 (Riley's channel override) |
| `--tk-border-radius` | `15px` (cards) / `5px` (controls) | store customizer SCSS |
| `--tk-font-family` | Montserrat (UI), Mitr (on-label text) with system fallback | store + Charter §7.3 |

Partners override these via `theme` (init) and host CSS on `tk-` classes (`docs/02` §3). No external
Riley's-specific asset is required — Riley's just overrides `headerBackground` to its orange.

## 4. Fonts — bundled, never third-party (constraint)

The SDK must not make third-party requests (Charter §10.2), so it **cannot** load Google Fonts at
runtime. Two consequences:
- **Mitr** is used to render the on-label personalization text on the canvas (`renderPetName`,
  `docs/05` §7). For deterministic rendering (and golden tests in Node), **bundle a subset of Mitr**
  as a font asset loaded inside the designer chunk (and load it in the Node golden harness). The
  engine already awaits `document.fonts.ready` before measuring (`docs/05` §7).
- **Montserrat** (UI text) should degrade to a system stack if not host-provided; it is not
  pixel-critical. Only Mitr affects the printed composite.

Record the bundled-Mitr decision in `docs/09-decisions.md` when Phase 2 begins.
