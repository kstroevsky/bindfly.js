import { expect, test } from '@playwright/test'

const consoleProblems = new WeakMap<import('@playwright/test').Page, string[]>()

test.beforeEach(async ({ page }) => {
	const problems: string[] = []
	consoleProblems.set(page, problems)
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning') problems.push(`${message.type()}: ${message.text()}`)
	})
	page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
})

test.afterEach(async ({ page }) => {
	expect(consoleProblems.get(page) ?? []).toEqual([])
})

const metric = (page: import('@playwright/test').Page, name: string) =>
	page.locator('.metric').filter({ has: page.locator('dt', { hasText: name }) }).locator('dd')

test('main and worker runtimes start and accept interaction', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { name: 'Flying Lines' })).toBeVisible()
	await expect(metric(page, 'Points')).toHaveText('100')

	const canvas = page.getByLabel('Interactive Flying Lines simulation')
	await canvas.click({ position: { x: 160, y: 120 } })
	await expect(metric(page, 'Points')).toHaveText('101')

	const runtime = page.getByLabel('Runtime')
	await expect(runtime.locator('option[value="worker"]')).toBeEnabled()
	await runtime.selectOption('worker')
	await expect(page.locator('.badge')).toContainText('worker')
	await expect(metric(page, 'Points')).toHaveText('100')
	await canvas.click({ position: { x: 180, y: 140 } })
	await expect(metric(page, 'Points')).toHaveText('101')
	await page.locator('#parameter-background').fill('#111827')
	await expect(metric(page, 'Points')).toHaveText('101')
})

test('hot updates preserve the running world and URL state restores it', async ({ page }) => {
	await page.goto('/')
	await expect.poll(async () => Number(await metric(page, 'Step').textContent())).toBeGreaterThan(120)
	const stepBefore = Number(await metric(page, 'Step').textContent())
	await page.getByLabel('Interactive Flying Lines simulation').click({ position: { x: 160, y: 120 } })
	await expect(metric(page, 'Points')).toHaveText('101')

	const background = page.locator('#parameter-background')
	await background.fill('#123456')
	await expect(background).toHaveValue('#123456')
	await expect(metric(page, 'Points')).toHaveText('101')
	await expect.poll(async () => Number(await metric(page, 'Step').textContent()), { timeout: 500 }).toBeGreaterThan(stepBefore)

	const restoredUrl = page.url()
	await page.goto('about:blank')
	await page.goto(restoredUrl)
	await expect(background).toHaveValue('#123456')
	await expect(metric(page, 'Points')).toHaveText('100')
})

test('canonical JSON export can be imported after a local change', async ({ page }) => {
	await page.goto('/')
	const downloadPromise = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Export JSON' }).click()
	const download = await downloadPromise
	const downloadPath = await download.path()
	if (!downloadPath) throw new Error('Exported Studio state did not produce a local file.')

	const background = page.locator('#parameter-background')
	await background.fill('#abcdef')
	await page.locator('#state-import').setInputFiles(downloadPath)
	await expect(page.locator('.share-status')).toHaveText('Canonical JSON imported.')
	await expect(background).toHaveValue('#050508')
})

test('mobile viewport keeps controls and simulation available', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')
	await expect(page.getByLabel('Experiment controls')).toBeVisible()
	await expect(page.getByLabel('Interactive Flying Lines simulation')).toBeVisible()
	await expect(metric(page, 'Points')).toHaveText('100')
})

test('Drooping Lines runs through the same main and worker Studio paths', async ({ page }) => {
	await page.goto('/#/lab/drooping-lines')
	await expect(page.getByRole('heading', { name: 'Drooping Lines' })).toBeVisible()
	await expect(page.locator('#parameter-formulaAX')).toHaveValue('tan(x)')
	await expect(page.locator('#parameter-formulaMorph')).toHaveValue('0')
	await expect(metric(page, 'Points')).toHaveText('100')

	const canvas = page.getByLabel('Interactive Drooping Lines simulation')
	await canvas.click({ position: { x: 180, y: 140 } })
	await expect(metric(page, 'Points')).toHaveText('101')
	await page.locator('#parameter-formulaMorph').fill('1')
	await page.locator('#parameter-formulaMorph').dispatchEvent('change')
	await expect(metric(page, 'Points')).toHaveText('101')
	await expect(page).toHaveURL(/#\/lab\/drooping-lines/)

	await page.getByLabel('Runtime').selectOption('worker')
	await expect(page.locator('.badge')).toContainText('worker')
	await expect(metric(page, 'Points')).toHaveText('100')
	await canvas.click({ position: { x: 200, y: 160 } })
	await expect(metric(page, 'Points')).toHaveText('101')
})
