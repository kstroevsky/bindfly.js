import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './apps/studio/e2e',
	testMatch: 'stage16-collaboration.spec.ts',
	fullyParallel: false,
	retries: 0,
	reporter: 'list',
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
	],
	use: {
		baseURL: 'http://127.0.0.1:3001',
		headless: true,
		trace: 'retain-on-failure',
	},
	webServer: {
		command: 'pnpm exec webpack serve --config webpack.v2.config.js --mode development --host 127.0.0.1',
		url: 'http://127.0.0.1:3001',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
})
