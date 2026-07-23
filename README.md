# Treatink Customizer SDK

**`@treatink/sdk`** — a TypeScript/JavaScript library that storefronts embed to add Treatink
product personalization: a native modal designer (photo upload, cutout selection, positioning,
pet-name text) plus a typed, publishable-key API client.

> The SDK runs end-to-end in **fixtures mode** (no backend, no network, deterministic ids) — the
> default, so you can integrate and demo fully offline. Live catalog + order submission are
> available behind `mode: 'live'`.

📚 **Documentation:** <https://sdk-docs.treatink.com>

## Install

`@treatink/sdk` is distributed as a versioned package attached to **GitHub Releases**.

**For bundled apps:** install the release tarball directly by URL:

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

Full guides and API reference live at **<https://sdk-docs.treatink.com>**:

- [Quickstart](https://sdk-docs.treatink.com/docs/quickstart) — install, the copy-runnable client flow, order submission
- [Theming](https://sdk-docs.treatink.com/docs/guides/theming) — match the designer to your storefront
- [Security & privacy](https://sdk-docs.treatink.com/docs/guides/security) — key discipline, photo handling, CSP
- [API reference](https://sdk-docs.treatink.com/docs/api/types) — the full typed surface

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