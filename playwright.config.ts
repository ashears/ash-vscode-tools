import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/ui', fullyParallel: false, workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4317', viewport: { width: 1280, height: 900 }, browserName: 'chromium' },
  webServer: { command: 'node scripts/ui-server.mjs', url: 'http://127.0.0.1:4317', reuseExistingServer: false },
});
