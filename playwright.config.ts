import { defineConfig, devices } from '@playwright/test'

// a port of its own: a server someone left running on 3000 is not the test server
const PORT = Number(process.env.PORT ?? 3100)
const STUDIO_KEY = process.env.STUDIO_KEY ?? 'studio-key-for-tests'

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) },
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'api', testDir: 'tests/api' },
    { name: 'e2e', testDir: 'tests/e2e', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm start',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT), STUDIO_KEY },
  },
})
