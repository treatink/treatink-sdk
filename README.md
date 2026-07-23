# Treatink Customizer SDK

**`@treatink/sdk`** — a TypeScript/JavaScript library that storefronts embed to add Treatink
product personalization: a native modal designer (photo upload, cutout selection, positioning,
pet-name text) plus a typed, publishable-key API client.

> **Status:** pre-release, private. The SDK runs end-to-end in **fixtures mode** (no backend, no
> network, deterministic ids) — the default until the live API wiring ships. Live catalog + order
> submission paths exist behind `mode: 'live'`.

## Install

`@treatink/sdk` is distributed as a versioned package attached to **GitHub Releases** (it is not on
the public npm registry yet — moving to npm later requires no code changes for integrators).

**npm (bundled apps):** install the release tarball directly by URL:

```sh
npm install https://github.com/treatink/treatink-sdk/releases/download/v0.1.0/treatink-sdk-0.1.0.tgz
```

If you can't reach the URL anonymously (private repo), download `treatink-sdk-0.1.0.tgz` from the
release page while signed in to GitHub, then:

```sh
npm install ./treatink-sdk-0.1.0.tgz
```

Either way the package name is unchanged: `import { Treatink } from '@treatink/sdk'`.

**Script tag (no build step):** each release also attaches the browser ESM bundle. Download it,
self-host it with your storefront's static assets, and pin it with the SRI hash from the release
notes.

Working on the SDK itself? `npm install && npm run build` produces the package in `dist/`
(usable via `npm link` or a `file:` dependency). See [`RELEASING.md`](./RELEASING.md) for how
release artifacts are produced.

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