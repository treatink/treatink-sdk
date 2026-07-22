// Demo config template. Copy this file to `demo.config.js` (gitignored) and fill it in to point
// the demo storefront at a backend. With no demo.config.js present, the demo runs in fixtures
// mode with no network — no config needed.
//
// `env` picks a preset (see ENVS in storefront.html):
//   'fixtures' (default) — bundled fixtures, no network
//   'staging'            — live mode against https://staging.treatinkapi.com
//   'live'               — live mode against https://treatinkapi.com
// A one-off switch also works from the URL: ?env=staging (URL wins over this file).
//
// SAFE HERE: publishable keys only (pk_test_… / pk_live_…). Publishable keys are designed to ship
// in client-side code — this is the whole point of the publishable/secret split, and the SDK
// throws `key_scope_violation` if you ever pass a secret key.
// NEVER HERE: the secret sk_… key. It belongs in your SERVER's environment (see @treatink/sdk/server
// + docs/12), where it's used to submit orders. It must never reach the browser.
export default {
  // env: 'staging',
  // apiKey: 'pk_test_your_staging_publishable_key',
  // apiBaseUrl: 'https://…', // rare override — the env preset already sets the right host
};
