const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev',
      cwd: 'backend',
      url: 'http://localhost:5000/api/v1/health',
      reuseExistingServer: true,
      timeout: 60000,
      env: {
        ESCALATION_POLL_INTERVAL_MS: '2000',
        ESCALATION_ACK_WINDOW_MS: '4000',
        AUTO_ASSIGN_WINDOW_MS: '3000',
      },
    },
    {
      command: 'npm run dev',
      cwd: 'frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
