import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright tarayıcı indirmesi bu ortamda engelli olduğundan sistemdeki Chrome kullanılır.
 * CHROME_PATH ile değiştirilebilir. WebKit projesi isteğe bağlıdır (PW_WEBKIT=1) ve
 * gerçek iPhone/iPad Safari testi YERİNE GEÇMEZ.
 */
const chromePath = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chrome-desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: { executablePath: chromePath } },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'chrome-mobile',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath: chromePath } },
      testMatch: /mobile\.spec\.ts/,
    },
    ...(process.env.PW_WEBKIT ? [{ name: 'webkit-iphone', use: { ...devices['iPhone 15'] } }] : []),
  ],
});
