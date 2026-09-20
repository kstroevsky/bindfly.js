import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

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

test('speed reset stays healthy and the desktop sidebar scrolls independently', async ({ page }) => {
	await page.setViewportSize({ width: 1365, height: 692 })
	await page.goto('/#/lab/drooping-lines')
	const panel = page.getByLabel('Experiment controls')
	await expect(panel).toBeVisible()
	await expect.poll(() => panel.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
	await panel.evaluate((element) => { element.scrollTop = element.scrollHeight })
	await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)

	await page.locator('#parameter-maxSpeed').fill('90')
	await expect(page.locator('#parameter-maxSpeed')).toHaveValue('90')
	await expect(metric(page, 'Points')).toHaveText('100')
	await expect(page.getByText('Uncaught runtime errors:')).toHaveCount(0)
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
	const urlBeforeFormula = page.url()
	const formula = page.locator('#parameter-formulaAX')
	await formula.fill('')
	await formula.pressSequentially('x * 2')
	await expect(formula).toHaveValue('x * 2')
	await expect(page).toHaveURL(urlBeforeFormula)
	await page.getByRole('button', { name: 'Apply Formula AX' }).click()
	await expect.poll(() => page.url()).not.toBe(urlBeforeFormula)
	await page.getByRole('button', { name: 'Restore default Formula AX' }).click()
	await expect(formula).toHaveValue('tan(x)')
	await expect(page).toHaveURL(urlBeforeFormula)
	await page.locator('#parameter-formulaView').selectOption('compare')
	await expect(page.locator('#parameter-formulaView')).toHaveValue('compare')
	await page.locator('#parameter-formulaMorph').fill('1')
	await expect(metric(page, 'Points')).toHaveText('101')
	await expect(page).toHaveURL(/#\/lab\/drooping-lines/)

	await page.getByLabel('Runtime').selectOption('worker')
	await expect(page.locator('.badge')).toContainText('worker')
	await expect(metric(page, 'Points')).toHaveText('100')
	await canvas.click({ position: { x: 200, y: 160 } })
	await expect(metric(page, 'Points')).toHaveText('101')
})

test('Pulse and the Spiral family execute from frozen formulas through the generic Studio', async ({ page }) => {
	const originals = [
		['pulse-2023', 'Pulse 2023'],
		['spiral-1', 'Spiral I'],
		['spiral-2', 'Spiral II'],
		['spiral-3', 'Spiral III'],
	] as const
	for (const [id, title] of originals) {
		await page.goto(`/#/lab/${id}`)
		await expect(page.getByRole('heading', { name: title })).toBeVisible()
		await expect(metric(page, 'Points')).toHaveText('100')
		await expect.poll(async () => Number(await metric(page, 'Step').textContent())).toBeGreaterThan(0)
		await expect(page.locator('#parameter-formulaAX')).not.toHaveValue('')
	}

	await page.goto('/#/lab/pulse-2023')
	await page.locator('#parameter-formulaBX').fill('positionX + distance * sin(a)')
	await page.getByRole('button', { name: 'Apply Formula BX' }).click()
	await page.locator('#parameter-formulaView').selectOption('compare')
	await expect(page.locator('#parameter-formulaView')).toHaveValue('compare')
	await page.getByText('Inspector').click()
	await expect(page.getByRole('heading', { name: 'Formula provenance' })).toBeVisible()
	await expect(page.locator('.provenance')).toContainText('src/shared/2d/animations/Pulse/index.js')
	const downloadPromise = page.waitForEvent('download')
	await page.getByRole('button', { name: 'Export JSON' }).click()
	const download = await downloadPromise
	const downloadPath = await download.path()
	if (!downloadPath) throw new Error('Pulse export did not produce a local file.')
	const exported = JSON.parse(await readFile(downloadPath, 'utf8')) as {
		readonly format: string
		readonly provenance: readonly { readonly id: string; readonly legacyGitBlob: string }[]
	}
	expect(exported.format).toBe('bindfly-studio-export')
	expect(exported.provenance).toEqual([{
		id: 'pulse-2023',
		legacyGitBlob: '192936b1e58ebbbea7bc8d1ca1e20801c3f7a6ac',
		format: 'bindfly-original-formula',
		version: 1,
		legacyPath: 'src/shared/2d/animations/Pulse/index.js',
		capturedBehavior: 'drawLinesWithoutAdding per-particle coordinates',
	}])
	await page.getByLabel('Interactive Pulse 2023 simulation').click({ position: { x: 220, y: 180 } })
	await page.getByLabel('Runtime').selectOption('worker')
	await expect(page.locator('.badge')).toContainText('worker')
	await expect(metric(page, 'Points')).toHaveText('100')
})
