import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', timeout: 30000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo', reducedMotion: 'reduce' },
  webServer: { command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory www', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
