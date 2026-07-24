import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "E2E_TESTING=true MOCK_AI=true DATABASE_URL=file:./data/qiuzhitai.e2e.db BETTER_AUTH_SECRET=qiuzhitai-e2e-secret-at-least-thirty-two-characters pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
