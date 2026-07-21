# 12 · Integration Quickstart & API Reference

The doc a **cold developer** follows to add Treatink personalization to a storefront. It is the
operational form of the Charter §14 Definition of Done ("a new dev integrates in fixtures in
< 1 day from the docs"). Everything here runs in **fixtures mode** — no live backend, no network,
deterministic ids — which is the default until the live API is wired (`docs/09`, P4).

> **Lockstep guarantee.** The fixtures client flow below (between the `quickstart:flow` markers) is
> byte-identical to `test/e2e/harness/quickstart.html`, and `test/e2e/quickstart.spec.ts` runs that
> page through the whole catalog→open→upload→save→buildPayload→submit path on every CI run. If this
> sample and the shipping code ever drift, the `quickstart` gate goes red. The sample you copy is
> the sample we test.

---

## 1. Install

**npm (bundled apps):**

```sh
npm install @treatink/sdk
```

```ts
import { Treatink } from '@treatink/sdk';
```

**Script tag (no build step):** load the ESM build from the CDN and pin it with SRI (§5).

```html
<script type="module">
  import { Treatink } from 'https://sdk.treatink.com/v1/index.js';
  // …the flow from §2 goes here…
</script>
```

The browser bundle is publishable-key only. The **one** secret-key operation — submitting the
order — lives in a separate server entry (`@treatink/sdk/server`, §4) and is never importable from
browser code (`scripts/check-no-secret.mjs` enforces it).

## 2. The client flow (fixtures mode, copy-runnable)

Save this as an HTML file, serve it alongside a built copy of the SDK, and open it — the modal
designer runs end to end with no backend.

```html
<script type="module">
  import { Treatink } from '@treatink/sdk';

  // Your storefront's add-to-cart. In this fixtures demo it just records the line.
  function addToCart(line) {
    console.log('add to cart', line);
  }

  // quickstart:flow:start
  const tk = Treatink.init({
    apiKey: 'pk_test_quickstart',
    channel: 'rileyspets.com',
    mode: 'fixtures',
  });

  // Open the modal designer. In fixtures mode everything runs locally — no network,
  // deterministic ids — so this snippet is copy-runnable exactly as written.
  tk.designer.open({
    sku: 'SSGTTBC',
    cutoutLabelId: 'cut_fx_00000001', // optional: preselect a cutout (omit to let the shopper choose)
    onComplete(result) {
      // The shopper saved. Add the design to your cart: keep result.draftId as the line-item
      // reference and result.previewUrl (a local object URL) for the cart thumbnail.
      addToCart({ sku: result.sku, draftId: result.draftId, previewUrl: result.previewUrl });
    },
  });
  // quickstart:flow:end
</script>
```

What happens inside `onComplete` (see `DesignerResult`, §6.3): the two artwork assets
(`source` + `rendered`) have already uploaded, a **reference-only** draft is written to
`localStorage` (never any image bytes — Charter §9), and `result.previewUrl` is a local object URL
of the display composite. Persist `result.draftId` on the cart line — it is both the design's
handle and the order idempotency token.

## 3. Build the order body (browser, pure)

At checkout, turn the saved draft(s) into the order wire body. `buildPayload` is pure — no network,
nothing secret — and pulls `variant_id`, the asset ids, and the personalization block from the draft
by `draftId`.

```ts
const payload = tk.orders.buildPayload({
  externalOrderId: 'partner-1001', // your order id — also the idempotency key
  channelOrderNumber: '1001',
  currency: 'USD',
  paymentStatus: 'paid',
  customer: { email: 'shopper@example.com', firstName: 'Sam', lastName: 'Rivera' },
  lines: [{ externalLineItemId: 'li-1', draftId, quantity: 1, unitPriceCents: 999 }],
});
```

The result matches the order schema in `docs/08` §7 field-for-field. Send it to your own server —
the browser never holds a secret key.

## 4. Submit the order (server, secret key)

On your server (Node ≥ 18), submit with your **secret** key. Re-posting the same
`external_order_id` returns the original order, so retries are safe.

```ts
import { submitOrder } from '@treatink/sdk/server';

const order = await submitOrder(payload, {
  secretKey: process.env.TREATINK_SECRET_KEY, // sk_test_… | sk_live_…
  channel: 'rileyspets.com',
});
// order.status === 'received'; order.externalOrderId === 'partner-1001'
```

> The live `POST /v1/orders` endpoint is the backend's to build (GAP-PLAN, out-of-scope for the
> SDK). `submitOrder` targets the documented body and is testable against a mock today.

## 5. Recommended CSP & SRI (`docs/11` §5)

Ship a Content-Security-Policy that allows the SDK's script and its API/storage/image hosts, and
pin the CDN script with a Subresource-Integrity hash (published per release):

```
Content-Security-Policy:
  script-src 'self' sdk.treatink.com;
  connect-src 'self' api.treatink.com <storage-host>;
  img-src 'self' cdn.treatink.com blob: data:;
```

```html
<script
  type="module"
  src="https://sdk.treatink.com/v1/index.js"
  integrity="sha384-…"   <!-- from the release notes -->
  crossorigin="anonymous"
></script>
```

`async`/`defer` are safe; the SDK never calls `document.write`. Confirm `<storage-host>` with the
backend before publishing (their concern — GP-02).

## 6. Theming & copy

Pass `theme` and `copy` to `Treatink.init` — both are fully overridable (`docs/10` §8,
`docs/design-reference` §3). Theme values become `--tk-*` CSS variables; every user-visible string
has a `copy` key.

```ts
Treatink.init({
  apiKey: 'pk_test_quickstart',
  channel: 'rileyspets.com',
  theme: { primary: '#8EA0F6', accent: '#EA8D00', borderRadius: '15px' },
  copy: { headerTitle: 'Personalize Your Product', saveButton: 'Save Customization' },
});
```

## 7. API reference

The full, frozen TypeScript surface is **`docs/10-public-types.md`** (the contract `src/types.ts`
mirrors). Summary of what a partner touches:

### 7.1 Entry — `Treatink.init(config)`

| Field | Type | Notes |
|---|---|---|
| `apiKey` | `string` | **publishable only** (`pk_test_…` / `pk_live_…`); an `sk_…` key throws `key_scope_violation` |
| `channel` | `string` | your registered storefront hostname |
| `mode` | `'live' \| 'fixtures'` | default `'fixtures'` until the live API is wired |
| `apiBaseUrl` | `string?` | staging override; default `https://api.treatink.com` |
| `theme` / `copy` | objects | §6 |
| `maxPersonalizationLength` | `number?` | text cap fallback (default 20) |

### 7.2 Instance namespaces

| Namespace | Method | Purpose |
|---|---|---|
| `products` | `list(params?)` / `get(sku)` | catalog; `get` resolves SKU → variant |
| `templates` | `list({ sku })` | cutout-labels for a product |
| `artwork` | `upload({ role, file })` | two-step asset upload (`source`/`rendered`) — the designer calls this for you |
| `designer` | `open(options)` / `close()` | the modal designer |
| `drafts` | `list()` / `get(id)` / `delete(id)` / `clear()` | reference-only drafts (no image bytes) |
| `orders` | `buildPayload(input)` | pure order-body assembly (§3) |
| `on(event, handler)` | — | `'designer:open' \| 'designer:close' \| 'draft:saved' \| 'error'` |
| `fixtures` | `failNext(op, err)` / `setLatency(ms)` | present only in `mode:'fixtures'` |

### 7.3 `designer.open(options)` → `onComplete(result)`

`DesignerOptions`: `sku` (required), `draftId?` (re-open a saved draft — restores metadata; the
shopper re-selects the photo, `docs/10` §6), `personalizationText?`, `cutoutLabelId?`,
`onComplete?` / `onError?` / `onClose?`.

`DesignerResult`: `draftId`, `sku`, `variantId?`, `cutoutLabelId`, `personalizationText?`,
`petNamePosition?`, `previewUrl` (local object URL), `artwork { sourceAssetId, renderedAssetId }`,
`transform`, `labelZone`, `lowRes`.

### 7.4 Server — `submitOrder(payload, options)`

`options`: `secretKey` (`sk_…`), `channel`, `apiBaseUrl?`, `idempotencyKey?` (defaults to the
payload's `external_order_id`). Returns `{ id, orderNumber, status, externalOrderId }`. Never import
this from browser code.

Errors everywhere are `TreatinkError { code, status?, param?, requestId? }` (`docs/10` §7).
