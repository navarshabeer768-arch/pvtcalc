import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. These tests need a real (or local) Supabase project seeded
 * with two test users — see e2e/README.md — so they're not wired into a
 * default CI run without that setup.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
