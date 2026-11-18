import { defineConfig, devices } from "@playwright/test";
import process from "node:process";
import baseConfig from "./playwright.config";
import { soakLaunchOptions } from "playwright-soak-test";

export default defineConfig({
  ...baseConfig,
  testDir: "./tests/wanderwege/findingLeaks",
  projects: [
    {
      name: "finding-leaks",
      testMatch: /.*\.soak\.spec\.ts/,
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: soakLaunchOptions,
        trace: "off",
        video: "off",
      },
    },
  ],
  reporter: [["list"], ["playwright-soak-test/reporter"]],
  use: {
    ...baseConfig.use,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5174",
  },
});
