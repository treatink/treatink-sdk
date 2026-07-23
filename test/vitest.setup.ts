// Unit + golden tests run against local fixture asset paths (`/fixtures/…`), not the CDN default,
// so they stay hermetic and deterministic. Partners get the jsDelivr CDN default at runtime.
(globalThis as Record<string, unknown>).__treatinkFixtureAssetBase = '';
