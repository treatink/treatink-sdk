// Demo config template. Copy this file to `demo.config.js` (gitignored) and fill it in to point
// the demo storefront at a live/staging backend. With no demo.config.js present, the demo runs in
// fixtures mode with no network — no config needed.
//
// SAFE HERE: publishable keys only (pk_test_… / pk_live_…). Publishable keys are designed to ship
// in client-side code — this is the whole point of the publishable/secret split, and the SDK
// throws `key_scope_violation` if you ever pass a secret key.
// NEVER HERE: the secret sk_… key. It belongs in your SERVER's environment (see @treatink/sdk/server
// + docs/12), where it's used to submit orders. It must never reach the browser.
export default {
  // mode: 'live',
  // apiKey: 'pk_test_your_staging_publishable_key',
  // apiBaseUrl: 'https://api.staging.treatink.com', // omit to use the default https://api.treatink.com
};
