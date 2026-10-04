import { defineConfig, devices } from '@playwright/test'

// E2E wymagają: npm run db:start oraz npm run functions:serve (w osobnym terminalu).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  workers: 1,
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:5173',
    locale: 'pl-PL',
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
