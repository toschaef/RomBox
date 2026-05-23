import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Electron E2E tests are single-worker to prevent file/window conflicts
  reporter: 'line',
  use: {
    trace: 'on-first-retry',
  },
});
