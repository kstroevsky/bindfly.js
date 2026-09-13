import { defineConfig } from '@playwright/test'

export default defineConfig({
	testDir: './apps/studio/e2e',
	fullyParallel: false,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: 'http://127.0.0.1:3001',
		browserName: 'chromium',
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
