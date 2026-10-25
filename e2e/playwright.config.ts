import { defineConfig, devices } from "@playwright/test";
import { FRONT, API, ROOT } from "./support/env";

// Journeys run one at a time: the software renderer used in CI-like containers is slow, and the
// backend-down journey stops and restarts the shared API.
export default defineConfig({
  testDir: "./journeys",
  outputDir: "./output/results",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 15 * 60_000,
  expect: { timeout: 120_000 },
  reporter: [["list"], ["html", { outputFolder: "./output/report", open: "never" }]],
  globalSetup: "./support/global-setup.ts",
  globalTeardown: "./support/global-teardown.ts",
  use: {
    baseURL: FRONT,
    actionTimeout: 120_000,
    navigationTimeout: 180_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
    },
    {
      name: "phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 667, height: 375 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: process.env.E2E_EXTERNAL_FRONT
    ? undefined
    : {
        command: "npm run dev -- --port 5190 --host 127.0.0.1 --strictPort",
        cwd: `${ROOT}/frontend`,
        url: FRONT,
        env: { VITE_API_URL: API },
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
