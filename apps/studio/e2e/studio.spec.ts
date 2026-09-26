import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const consoleProblems = new WeakMap<import('@playwright/test').Page, string[]>()

test.beforeEach(async ({ page }) => {
	const problems: string[] = []
	consoleProblems.set(page, problems)
	page.on('console', (message) => {
		if (message.type() === 'warning' && message.text().includes('GL Driver Message') && message.text().includes('ReadPixels')) return
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
	await page.getByRole('button', { name: 'Compare' }).click()
	await expect(page.getByRole('button', { name: 'A / B' })).toHaveAttribute('aria-pressed', 'true')
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
	await page.getByRole('button', { name: 'Compare' }).click()
	await expect(page.getByRole('button', { name: 'A / B' })).toHaveAttribute('aria-pressed', 'true')
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

test('Vector Field and Discrete Map run through main and worker Studio paths', async ({ page }) => {
	const experiments = [
		{ id: 'vector-field-2d', title: 'Vector Field Lab', metric: 'Trajectories', stepLabel: 'Step' },
		{ id: 'discrete-map-2d', title: 'Discrete Map Lab', metric: 'Orbits', stepLabel: 'Iterate' },
	] as const

	for (const experiment of experiments) {
		await page.goto(`/#/lab/${experiment.id}`)
		await expect(page.getByRole('heading', { name: experiment.title })).toBeVisible()
		await expect(metric(page, experiment.metric)).toHaveText('1')
		const runtime = page.getByLabel('Runtime')
		await expect(runtime.locator('option[value="worker"]')).toBeEnabled()
		const canvas = page.getByLabel(`Interactive ${experiment.title} simulation`)
		await canvas.click({ position: { x: 260, y: 180 } })
		await expect(metric(page, experiment.metric)).toHaveText('2')

		await runtime.selectOption('worker')
		await expect(page.locator('.badge')).toContainText('worker')
		await expect(metric(page, experiment.metric)).toHaveText('1')
		await canvas.click({ position: { x: 280, y: 160 } })
		await expect(metric(page, experiment.metric)).toHaveText('2')

		await page.getByRole('button', { name: 'Freeze' }).click()
		await expect(page.getByRole('button', { name: 'Run' })).toBeEnabled()
		const frozenStep = Number(await metric(page, 'Step').textContent())
		await page.getByRole('button', { name: experiment.stepLabel, exact: true }).click()
		await expect(metric(page, 'Step')).toHaveText(String(frozenStep + 1))
	}
})

test('Scalar Field samples and probes through main and worker Studio paths without temporal controls', async ({ page }) => {
	await page.goto('/#/lab/scalar-field-2d')
	await expect(page.getByRole('heading', { name: 'Scalar Field Lab' })).toBeVisible()
	const samples = page.locator('.metric').filter({ has: page.locator('dt', { hasText: /^Samples$/ }) }).locator('dd')
	await expect.poll(async () => Number(await samples.textContent())).toBeGreaterThan(0)
	await expect(metric(page, 'Invalid samples')).toHaveText('0')

	const canvas = page.getByLabel('Interactive Scalar Field Lab simulation')
	await page.getByRole('button', { name: 'Probe point' }).click()
	await canvas.click({ position: { x: 250, y: 150 } })
	const probe = page.getByLabel('Point probe')
	await expect(probe).toBeVisible()
	await expect(probe).toContainText('Formula Probe · scalar field')
	await expect(probe).toContainText('z')
	await page.getByRole('button', { name: 'Clear probe' }).click()

	const runtime = page.getByLabel('Runtime')
	await expect(runtime.locator('option[value="worker"]')).toBeEnabled()
	await runtime.selectOption('worker')
	await expect(page.locator('.badge')).toContainText('worker')
	await expect.poll(async () => Number(await samples.textContent())).toBeGreaterThan(0)
	await canvas.click({ position: { x: 250, y: 150 } })
	await expect(page.getByLabel('Point probe')).toContainText('Formula Probe · scalar field')
	await expect(page.getByRole('button', { name: 'Run', exact: true })).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Freeze', exact: true })).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Step', exact: true })).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Reset', exact: true })).toHaveCount(0)
	await page.getByText('Inspector').click()
	await expect(page.getByText('Static field')).toBeVisible()
})

test('WebGL2 parity renderer uses the same Studio state for all Stage 15 benchmark experiments', async ({ page }) => {
	const experiments = [
		{ id: 'flying-lines', title: 'Flying Lines', metric: 'Points', expected: '100' },
		{ id: 'vector-field-2d', title: 'Vector Field Lab', metric: 'Trajectories', expected: '1' },
		{ id: 'discrete-map-2d', title: 'Discrete Map Lab', metric: 'Orbits', expected: '1' },
		{ id: 'scalar-field-2d', title: 'Scalar Field Lab', metric: 'Samples', expected: undefined },
	] as const

	for (const experiment of experiments) {
		await page.goto(`/#/lab/${experiment.id}`)
		await expect(page.getByRole('heading', { name: experiment.title })).toBeVisible()
		const renderer = page.getByLabel('Renderer')
		await expect(renderer.locator('option[value="webgl2"]')).toBeEnabled()
		const experimentMetric = experiment.metric === 'Samples'
			? page.locator('.metric').filter({ has: page.locator('dt', { hasText: /^Samples$/ }) }).locator('dd')
			: metric(page, experiment.metric)
		const before = experiment.expected ?? await experimentMetric.textContent()
		await renderer.selectOption('webgl2')
		await expect(renderer).toHaveValue('webgl2')
		await expect(page.getByLabel('Runtime')).toHaveValue('main')
		await expect(page.locator('.badge')).toContainText('webgl2 · main')
		if (before !== null) await expect(experimentMetric).toHaveText(before)

		await page.getByLabel('Runtime').selectOption('worker')
		await expect(renderer).toHaveValue('canvas2d')
		await expect(page.getByLabel('Runtime')).toHaveValue('worker')
		await expect(page.locator('.badge')).toContainText('canvas2d · worker')
	}
})

test('WebGL2 context loss restores renderer resources without changing mathematical state', async ({ page }) => {
	await page.goto('/?stage15Benchmark=1#/lab/scalar-field-2d')
	await page.getByLabel('Renderer').selectOption('webgl2')
	await expect(page.locator('.badge')).toContainText('webgl2 · main')
	const canvas = page.getByLabel('Interactive Scalar Field Lab simulation')
	const samples = page.locator('.metric').filter({ has: page.locator('dt', { hasText: /^Samples$/ }) }).locator('dd')
	await expect.poll(async () => Number(await samples.textContent())).toBeGreaterThan(0)
	const parity = page.locator('[data-stage15-parity="true"]')
	await expect(parity).toHaveCount(1)
	const stateBefore = {
		points: await samples.textContent(),
		invalid: await metric(page, 'Invalid samples').textContent(),
		simulation: await parity.getAttribute('data-stage15-simulation-checksum'),
		renderView: await parity.getAttribute('data-stage15-render-view-checksum'),
	}
	const pixelBefore = await canvas.evaluate((element) => {
		const gl = (element as HTMLCanvasElement).getContext('webgl2')
		if (!gl) return null
		const pixel = new Uint8Array(4)
		gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
		return Array.from(pixel)
	})

	const restored = await canvas.evaluate(async (element) => {
		const gl = (element as HTMLCanvasElement).getContext('webgl2')
		const extension = gl?.getExtension('WEBGL_lose_context')
		if (!gl || !extension) return false
		const lost = new Promise<void>((resolve) => element.addEventListener('webglcontextlost', () => resolve(), { once: true }))
		extension.loseContext()
		await lost
		await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
		const restoredEvent = new Promise<void>((resolve) => element.addEventListener('webglcontextrestored', () => resolve(), { once: true }))
		extension.restoreContext()
		await restoredEvent
		return true
	})
	if (!restored) test.skip(true, 'WEBGL_lose_context is unavailable in this browser.')

	await expect(samples).toHaveText(stateBefore.points ?? '')
	await expect(metric(page, 'Invalid samples')).toHaveText(stateBefore.invalid ?? '')
	await expect.poll(() => parity.getAttribute('data-stage15-simulation-checksum')).toBe(stateBefore.simulation)
	await expect.poll(() => parity.getAttribute('data-stage15-render-view-checksum')).toBe(stateBefore.renderView)
	if (pixelBefore) {
		await expect.poll(() => canvas.evaluate((element) => {
			const gl = (element as HTMLCanvasElement).getContext('webgl2')
			if (!gl) return null
			const pixel = new Uint8Array(4)
			gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel)
			return Array.from(pixel)
		})).toEqual(pixelBefore)
	}
})

test('experiments without a WebGL2 profile keep the renderer unavailable', async ({ page }) => {
	await page.goto('/#/lab/drooping-lines')
	const renderer = page.getByLabel('Renderer')
	await expect(renderer).toHaveValue('canvas2d')
	await expect(renderer.locator('option[value="webgl2"]')).toHaveAttribute('disabled', '')
})

test('Freeze keeps simulation state fixed while formula perturbations remain inspectable', async ({ page }) => {
	await page.goto('/#/lab/pulse-2023')
	await expect.poll(async () => Number(await metric(page, 'Step').textContent())).toBeGreaterThan(0)
	await page.getByRole('button', { name: 'Freeze' }).click()
	await expect(page.getByRole('button', { name: 'Run' })).toBeEnabled()
	const frozenStep = await metric(page, 'Step').textContent()

	const formula = page.locator('#parameter-formulaBX')
	await formula.fill('positionX + distance * sin(a)')
	await page.getByRole('button', { name: 'Apply Formula BX' }).click()
	await expect(metric(page, 'Step')).toHaveText(frozenStep ?? '')
	await expect(page.getByRole('heading', { name: 'Formula trail' })).toBeVisible()
	await expect(page.locator('.formula-history li')).toHaveCount(2)

	await page.locator('.formula-history li').first().getByRole('button').click()
	await expect(formula).toHaveValue('positionX + distance * cos(a) * -1')
	await expect(metric(page, 'Step')).toHaveText(frozenStep ?? '')

	await page.getByRole('button', { name: 'Step', exact: true }).click()
	const steppedStep = Number(frozenStep) + 1
	await expect(metric(page, 'Step')).toHaveText(String(steppedStep))
	await expect(page.locator('.formula-history li')).toHaveCount(1)
	await expect(page.locator('.formula-history li').first()).toContainText(`step ${steppedStep}`)
	await page.getByRole('button', { name: 'Run' }).click()
	await expect(page.getByRole('heading', { name: 'Formula trail' })).toHaveCount(0)
})

test('Stage 17 frozen and dynamic sweeps keep their reproducibility semantics distinct', async ({ page }) => {
	await page.goto('/#/lab/pulse-2023')
	const formula = page.locator('#parameter-formulaAX')
	await formula.fill('positionX + distance * cos(a) * k * -1')
	await page.getByRole('button', { name: 'Apply Formula AX' }).click()
	await expect.poll(async () => Number(await metric(page, 'Step').textContent())).toBeGreaterThan(0)
	await page.getByRole('button', { name: 'Freeze' }).click()
	const frozenStep = await metric(page, 'Step').textContent()

	await page.getByLabel('Sweep start').fill('0.8')
	await page.getByLabel('Sweep end').fill('1.2')
	await page.getByLabel('Sweep step', { exact: true }).fill('0.1')
	await page.getByRole('button', { name: 'Execute parameter sweep' }).click()
	await expect(page.locator('.sweep-card')).toHaveCount(5)
	await expect(page.locator('.sweep-provenance')).toContainText('frozen formula state')
	await expect(page.locator('.sweep-provenance')).toContainText(`step ${frozenStep}`)
	await expect(metric(page, 'Step')).toHaveText(frozenStep ?? '')
	await expect(page.locator('#parameter-k')).toHaveValue('1')

	await page.getByRole('button', { name: 'Run', exact: true }).click()
	await page.getByLabel('Sweep semantics').selectOption('dynamic-simulation')
	await page.getByLabel('Sweep start').fill('0.8')
	await page.getByLabel('Sweep end').fill('1')
	await page.getByLabel('Sweep step', { exact: true }).fill('0.1')
	await page.getByLabel('Dynamic sweep step count').fill('12')
	await page.getByRole('button', { name: 'Execute parameter sweep' }).click()
	await expect(page.locator('.sweep-card')).toHaveCount(3)
	await expect(page.locator('.sweep-provenance')).toContainText('dynamic fixed-step reruns')
	await expect(page.locator('.sweep-provenance')).toContainText('same initial state · 12 steps/sample')
})

test('Stage 17 saved experiments restore canonical state and guided challenges read live evidence', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByRole('heading', { name: 'Guided learning & challenges' })).toBeVisible()
	await page.getByLabel('Saved experiment name').fill('Baseline fixture')
	await page.getByRole('button', { name: 'Save current' }).click()
	await expect(page.locator('.saved-list')).toContainText('Baseline fixture')

	const background = page.locator('#parameter-background')
	await background.fill('#abcdef')
	await expect(background).toHaveValue('#abcdef')
	await page.locator('.saved-list').getByRole('button', { name: 'Load' }).click()
	await expect(background).toHaveValue('#050508')
	await expect(page.locator('.share-status')).toContainText("Loaded 'Baseline fixture'.")

	await page.getByRole('button', { name: 'Freeze' }).click()
	await page.getByRole('button', { name: 'Step', exact: true }).click()
	await expect(page.locator('.learning-module[data-learning-status="complete"]')).toContainText('Causality: freeze one mathematical moment')
	await expect(page.locator('.performance-evidence')).toContainText('FPS')
	await expect(page.locator('.performance-evidence')).toContainText('Backend')
})

test('Difference and Probe expose synchronized formula causality on main and worker runtimes', async ({ page }) => {
	await page.goto('/#/lab/pulse-2023')
	await page.locator('#parameter-particleCount').fill('3')
	const formulas = [
		['AX', '100'],
		['AY', '100'],
		['BX', '110'],
		['BY', '100'],
	] as const
	for (const [axis, source] of formulas) {
		const field = page.locator(`#parameter-formula${axis}`)
		await field.fill(source)
		await page.getByRole('button', { name: `Apply Formula ${axis}` }).click()
	}
	await page.getByRole('button', { name: 'Compare' }).click()
	await page.getByRole('button', { name: 'Difference vectors' }).click()
	await expect(page.getByRole('button', { name: 'Difference vectors' })).toHaveAttribute('aria-pressed', 'true')

	const assertProbe = async () => {
		await page.getByRole('button', { name: 'Probe point' }).click()
		const simulation = page.getByLabel('Interactive Pulse 2023 simulation')
		await expect.poll(async () => {
			await simulation.click({ position: { x: 100, y: 100 } })
			return page.getByLabel('Point probe').count()
		}, { timeout: 5_000 }).toBe(1)
		const probe = page.getByLabel('Point probe')
		await expect(probe).toBeVisible()
		await expect(probe).toContainText('A valid / B valid')
		await expect(probe).toContainText('dx')
		await expect(probe).toContainText('10.0000')
		await expect(probe.getByText('Scope')).toBeVisible()
		await probe.getByText('Trace · Formula A').click()
		await expect(probe).toContainText('x · 100')
		await page.getByRole('button', { name: 'Clear probe' }).click()
		await page.getByRole('button', { name: /Probe on/ }).click()
	}

	await assertProbe()
	await page.getByLabel('Runtime').selectOption('worker')
	await expect(page.locator('.badge')).toContainText('worker')
	await assertProbe()
})

test('Analyze computes persistence in the dedicated Ripser WASM worker', async ({ page }) => {
	await page.goto('/#/lab/pulse-2023')
	await page.locator('#parameter-particleCount').fill('20')
	await expect(metric(page, 'Points')).toHaveText('20')
	await page.getByRole('button', { name: 'Analyze' }).click()
	await page.getByLabel('Persistence epsilon maximum').selectOption('250')
	await page.getByRole('button', { name: 'Analyze this frame' }).click()

	await expect(page.getByRole('heading', { name: 'Persistence' })).toBeVisible({ timeout: 15_000 })
	await expect(page.locator('.persistence-heading > span')).not.toHaveText('budget')
	await expect(page.locator('.analysis-provenance').filter({ hasText: 'Backend' })).toContainText('ripser-wasm v1 · 01add51f')
	await expect(page.locator('.persistence-metrics')).toContainText('H₀ intervals')
})
