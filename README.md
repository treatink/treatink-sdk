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

## Development

Working on the SDK itself? Clone the repo, `npm install`, then `npm run dev` and open
<http://localhost:5199/demo/storefront.html>. `npm run verify` runs the main gates
(typecheck + lint + tests + bundle budgets).

- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — commands, repo layout, commit conventions
- [`BLUEPRINT.md`](./BLUEPRINT.md) — the build blueprint and ground-truth priority order
- [`AGENTS.md`](./AGENTS.md) / [`STATE.md`](./STATE.md) — the automated build loop and its ledger
- [`RELEASING.md`](./RELEASING.md) — release process

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