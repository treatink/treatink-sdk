# Treatink Customizer SDK

**`@treatink/sdk`** — a TypeScript/JavaScript library that storefronts embed to add Treatink
product personalization: a native modal designer (photo upload, cutout selection, positioning,
pet-name text) plus a typed, publishable-key API client.

> **Status:** pre-release, private. The SDK runs end-to-end in **fixtures mode** (no backend, no
> network, deterministic ids) — the default until the live API wiring ships. Live catalog + order
> submission paths exist behind `mode: 'live'`.

## Install

```sh
npm install @treatink/sdk
```

A script-tag build (CDN + SRI-pinned) is also available for storefronts without a build step.

## Quickstart

```ts
import { Treatink } from '@treatink/sdk';

const tk = Treatink.init({
  apiKey: 'pk_test_quickstart', // publishable key only — sk_… keys throw
  channel: 'rileyspets.com',
  mode: 'fixtures',
});

tk.designer.open({
  sku: 'SSGTTBC',
  onComplete(result) {
    // shopper saved — keep result.draftId for the cart line, result.previewUrl for the thumbnail
  },
});
```

At checkout, `tk.orders.buildPayload(...)` assembles the order body in the browser (nothing
secret), and your server submits it with the one secret-key operation:

```ts
import { submitOrder } from '@treatink/sdk/server';

const order = await submitOrder(payload, {
  secretKey: process.env.TREATINK_SECRET_KEY,
  channel: 'rileyspets.com',
});
```

## Documentation

- **[Integration guide](./docs/12-integration-quickstart.md)** — install, the copy-runnable client
  flow, order building & submission, CSP & SRI, privacy disclosure, theming, and the full API
  reference. The fixtures-mode sample is CI-tested on every build — the sample you copy is the
  sample we test.
- **[Public types](./docs/10-public-types.md)** — the frozen TypeScript surface.

## Privacy & security by design

- **Shopper photos never leave your control silently.** The photo uploads **only to Treatink
  infrastructure**, over TLS, and **only when the shopper saves** — nothing is sent while editing.
- **Zero third-party requests.** No analytics, trackers, or external fonts — enforced by an
  automated gate on every build.
- **No image bytes on the device.** Saved drafts are references only (asset ids + layout metadata),
  never photo data. `tk.drafts.clear()` wipes them for shared devices.
- **No secret keys in the browser.** The browser bundle is publishable-key only; `submitOrder`
  lives in a separate server-only entry, and a build gate proves no secret-key path can be bundled
  into browser code.
- **Fully themeable.** Colors, radii, and every user-visible string are overridable via `theme` and
  `copy` — no iframes, no locked-in look.

## Demo

A full mock storefront (product grid → designer modal → cart) ships in this repo — see
[Development](#development) to run it locally. A hosted demo is planned for the public release.

## Development

Working on the SDK itself? Clone the repo, `npm install`, then `npm run dev` and open
<http://localhost:5199/demo/storefront.html>. `npm run verify` runs the main gates
(typecheck + lint + tests + bundle budgets).

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — commands, repo layout, commit conventions
- [`BLUEPRINT.md`](./BLUEPRINT.md) — the build blueprint and ground-truth priority order
- [`AGENTS.md`](./AGENTS.md) / [`STATE.md`](./STATE.md) — the automated build loop and its ledger
- [`RELEASING.md`](./RELEASING.md) — release process
