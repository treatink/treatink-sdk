# Treatink Customizer SDK

**`@treatink/sdk`** — a TypeScript/JavaScript library that storefronts embed to add Treatink
product personalization: a native modal designer (photo upload, cutout selection, positioning,
pet-name text) plus a typed, publishable-key API client.

> **Status:** pre-release, private. The SDK runs end-to-end in **fixtures mode** (no backend, no
> network, deterministic ids) — the default until the live API wiring ships. Live catalog + order
> submission paths exist behind `mode: 'live'`.

## Install

> **Not yet published.** `@treatink/sdk` is not on npm yet — the command below is what the first
> public release will look like. Until then, work from this repo: `npm install && npm run build`
> produces the package in `dist/` (usable via `npm link` or a file: dependency).

```sh
npm install @treatink/sdk   # after the first public release
```

A script-tag build (CDN + SRI-pinned) will ship alongside the npm release for storefronts without
a build step.

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

| Read this | When you need |
| --- | --- |
| [Integration guide](./docs/12-integration-quickstart.md) | The full copy-runnable flow: init → designer → cart line → order body → server submit, plus CSP/SRI snippets and the API reference. CI runs the exact sample on every build. |
| [Public types](./docs/10-public-types.md) | Every public TypeScript type — config, namespaces, `DesignerResult`, `DraftRecord`, errors, theme & copy keys. |
| [Security model](./docs/11-security.md) | Key handling, photo privacy guarantees, CSP recommendations, what the build gates enforce. |
| [API reconciliation](./docs/04-api-reconciliation.md) | How SDK calls map to the real `treatinkapi.com/v1` wire contract, endpoint by endpoint. |

Key facts worth knowing up front:

- **Keys:** browser code takes publishable `pk_…` keys only (`sk_…` throws `key_scope_violation`);
  the single secret-key operation (`submitOrder`) lives in the separate `@treatink/sdk/server`
  entry, and a build gate proves no secret-key path exists in the browser bundle.
- **Photos:** upload only to Treatink infrastructure, over TLS, and only when the shopper saves.
  Drafts store references (asset ids + layout), never image bytes; `tk.drafts.clear()` wipes them.
- **Network:** zero third-party requests — no analytics, trackers, or external fonts (gated in CI).
- **Theming:** colors, radii, and every visible string are overridable via `theme` and `copy`;
  accepted photo formats are PNG/JPEG/HEIC up to 25 MB, 12,000 px per side.

## Demo

A full mock storefront (product grid → designer modal → cart) ships in this repo. To start it, run
`npm run dev` and open <http://localhost:5199/demo/storefront.html>. By default it runs in
**fixtures mode** — fully offline, no keys needed.

To run the demo against **staging**, create a `demo.config.js` file inside the `demo/` folder with
the following content (the file is gitignored — your key stays local):

```js
export default {
  env: 'staging', // or 'production'
  apiKey: 'pk_test_your_publishable_key_here',
};
```

Publishable (`pk_…`) keys only — never put a secret `sk_…` key in browser code; the SDK refuses
them by design. A hosted demo is planned for the public release.

## Development

Working on the SDK itself? Clone the repo, `npm install`, then `npm run dev` and open
<http://localhost:5199/demo/storefront.html>. `npm run verify` runs the main gates
(typecheck + lint + tests + bundle budgets).

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — commands, repo layout, commit conventions
- [`BLUEPRINT.md`](./BLUEPRINT.md) — the build blueprint and ground-truth priority order
- [`AGENTS.md`](./AGENTS.md) / [`STATE.md`](./STATE.md) — the automated build loop and its ledger
- [`RELEASING.md`](./RELEASING.md) — release process
