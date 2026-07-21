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

## 3. Default theme — SUPERSEDED by `docs/13-visual-parity.md` §1 (VP-01, 2026-07-21)

> **⚠️ CORRECTION.** This table originally carried the Charter §7.3 palette (`#8EA0F6`/`#EA8D00`),
> which does **not** match the real site. Owner decision VP-01 (`docs/09`): defaults are the exact
> store palette, extracted from `../treatink/web/src/index.css:48-67`. The authoritative token
> table (including derived shades, radii trio, and the ThemeConfig additions) is
> **`docs/13-visual-parity.md` §1**.

| Token | Default | Source |
|---|---|---|
| `--tk-primary` | `#a99cdf` (store `--purple`) | `index.css:59` |
| `--tk-primary-strong` | `#8c7ec2` (store `--purple-darker`) | `index.css:60` |
| `--tk-panel` | `#e2e6ff` (store `--purple-light`) | `index.css:61` |
| `--tk-accent` | `#ffa518` (store `--orange`) | `index.css:53` |
| `--tk-accent-hover` | `#dd9133` (store `--orange-hover`) | `index.css:57` |
| `--tk-header-background` | `#F26B1D` | Charter §7.3 (SDK modal chrome — VP-04) |
| radii | `20px` cards / `15px` buttons / `10px` controls | store SCSS + `Button.scss` |
| `--tk-font-family` | Montserrat (UI), Mitr (headings + on-label text), system fallback | store `index.css` |

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
