import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT) || 3000;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      `E2E_TESTING=true MOCK_AI=true DATABASE_URL=file:./data/qiuzhitai.e2e.db BETTER_AUTH_SECRET=qiuzhitai-e2e-secret-at-least-thirty-two-characters BETTER_AUTH_URL=${baseURL} pnpm dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
