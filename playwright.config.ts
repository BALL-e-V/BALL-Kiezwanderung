import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { soakLaunchOptions } from 'playwright-soak-test';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const viteCli = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './/tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['playwright-soak-test/reporter'],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174',
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /.*\.soak\.spec\.ts/,
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'] },
      testMatch: /wanderwege-(page|navigation)\.spec\.ts/,
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /.*\.soak\.spec\.ts/,
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /.*\.soak\.spec\.ts/,
    },
    {
      name: 'soak',
      testMatch: /.*\.soak\.spec\.ts/,
      workers: 1,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: soakLaunchOptions,
        trace: 'off',
        video: 'off',
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `"${process.execPath}" "${viteCli}" dev --host 127.0.0.1 --port 5174 --strictPort`,
        url: 'http://127.0.0.1:5174',
        env: {
          PLAYWRIGHT_TEST_AUTH: '1',
          VITE_PLAYWRIGHT_TEST_AUTH: '1',
        },
        reuseExistingServer: false,
      },
});
