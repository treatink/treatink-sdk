import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs in FIXTURES mode against a tiny static harness that mounts the SDK (test/e2e/harness).
 * No real network — the no-third-party-request assertion (docs/11 §2) lives in these specs.
 */
export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list', // CI is Bitbucket Pipelines — no GitHub annotations

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run harness', // serves test/e2e/harness (added in P2)
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }, // Safari ≥16 parity (Charter §13)
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
});
