import { defineConfig } from '@playwright/test'

export default defineConfig({
	testDir: './tooling/stage-15',
	fullyParallel: false,
	retries: 0,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:3001',
		browserName: 'chromium',
		headless: true,
		viewport: { width: 1440, height: 900 },
		deviceScaleFactor: 1,
	},
	webServer: {
		command: 'pnpm exec webpack serve --config webpack.v2.config.js --mode production --host 127.0.0.1',
		url: 'http://127.0.0.1:3001',
		reuseExistingServer: false,
		timeout: 120_000,
	},
})
