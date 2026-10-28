import { defineConfig } from '@playwright/test';
export default defineConfig({
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit', isMobile: true, hasTouch: true } }],
  testDir: './tests/e2e', timeout: 30000, workers: 1,
  use: { trace: 'retain-on-failure', baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo', reducedMotion: 'reduce' },
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory www', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
