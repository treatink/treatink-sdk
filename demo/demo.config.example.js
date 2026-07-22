// Demo config template. Copy this file to `demo.config.js` (gitignored) and fill it in to point
// the demo storefront at a backend. With no demo.config.js present, the demo runs in fixtures
// mode with no network — no config needed.
//
// `env` picks a preset (see ENVS in storefront.html):
//   'fixtures' (default) — bundled fixtures, no network
//   'staging'            — live mode against https://staging.treatinkapi.com
//   'live'               — live mode against https://treatinkapi.com
// A one-off switch also works from the URL: ?env=staging (URL wins over this file).
export default {
  // env: 'staging',
  // apiKey: 'pk_test_your_staging_publishable_key',
  // apiBaseUrl: 'https://…', // rare override — the env preset already sets the right host
};
