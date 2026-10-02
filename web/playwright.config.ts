import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the running stack:
 *   API  -> http://localhost:8000 (seeded with `python -m app.seed`)
 *   Web  -> http://localhost:3000 (`npm run build && npm run start`)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /(mobile|flutter-parent)\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
    // Opt-in: needs the Flutter web build served on :8090.
    { name: "flutter", use: { ...devices["Desktop Chrome"] }, testMatch: /flutter-parent\.spec\.ts/ },
  ],
});
