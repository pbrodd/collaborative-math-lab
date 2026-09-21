import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:3108', trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/browser-server.mjs',
    url: 'http://127.0.0.1:3108/api/health',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
