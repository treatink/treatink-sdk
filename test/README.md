# test/

| Dir | What | Runner | Gate |
|---|---|---|---|
| (co-located `src/**/*.test.ts`) | unit tests next to source (preferred) | Vitest | `npm test` |
| `unit/` | shared unit helpers + cross-module units | Vitest | `npm test` |
| `golden/` | engine golden tests + `fixtures/` inputs + frozen `expected/` (docs/06 §3) | Vitest | `npm run test:golden` |
| `e2e/` | Playwright specs in fixtures mode + `harness/` (mounts the SDK) | Playwright | `npm run test:e2e` |
| `a11y/` | axe checks on the open modal | Playwright | `npm run test:a11y` |

Golden baselines are generated **from the store's own render code run headless** (`golden/gen-baseline.mjs`),
never from this engine — that's what makes them a correctness contract, not a self-check.
Determinism: no real network, no wall-clock/random in assertions (docs/02 §8).
