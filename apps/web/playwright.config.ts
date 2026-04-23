import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'cd ../api && npx tsx src/index.ts',
      port: 3001,
      reuseExistingServer: true,
      env: {
        DATABASE_URL: 'postgresql://financiero:financiero_test@localhost:5435/financiero_test?schema=public',
        NODE_ENV: 'test',
        JWT_SECRET: 'dev-secret-change-me',
      },
    },
    {
      command: 'npx next dev --port 3000',
      port: 3000,
      reuseExistingServer: true,
    },
  ],
});
