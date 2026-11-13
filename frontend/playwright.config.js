import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import process from 'node:process';
const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export default defineConfig({
  testDir: './e2e', timeout: 45000, workers: 2,
  outputDir: '../tmp/browser-results', reporter: [['list'], ['json', { outputFile: '../tmp/browser-results.json' }]],
  use: { baseURL: 'http://localhost:5187', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.GROCEREASE_BROWSER_PATH || (existsSync(localChrome) ? localChrome : undefined) } },
  webServer: process.env.GROCEREASE_EXTERNAL_PREVIEW ? undefined : { command: 'node node_modules/vite/bin/vite.js --host localhost --port 5187 --strictPort', url: 'http://localhost:5187', reuseExistingServer: false, timeout: 30000 },
});
