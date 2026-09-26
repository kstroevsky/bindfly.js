import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
	STAGE_15_RENDERING_BENCHMARK_VERSION,
	STAGE_15_RENDERING_WORKLOADS,
} from '../../src-v2/benchmarks/stage-15-rendering-workloads.ts'

const CPU_TIMING_METRICS = ['simulationMs', 'derivationMs', 'uploadMs', 'renderMs', 'totalFrameMs'] as const
const STATE_METRICS_BY_EXPERIMENT = {
	'flying-lines': ['step', 'points', 'edges', 'components'],
	'vector-field-2d': ['step', 'points', 'edges'],
	'discrete-map-2d': ['step', 'points', 'edges'],
	'scalar-field-2d': ['points', 'edges'],
} as const
type RendererId = 'canvas2d' | 'webgl2'
type NumericSample = Record<string, number>
interface ParitySample {
	readonly simulationChecksum: string
	readonly renderViewChecksum: string
	readonly postRenderSimulationChecksum: string
	readonly postRenderViewChecksum: string
}
interface BenchmarkSample extends NumericSample {
	readonly parity: ParitySample
}

const REPEAT_COUNT = Math.max(1, Number.parseInt(process.env.STAGE15_REPEAT_COUNT ?? '4', 10) || 4)
const COUNTERBALANCED_ORDERS: readonly (readonly RendererId[])[] = [
	['canvas2d', 'webgl2'],
	['webgl2', 'canvas2d'],
	['webgl2', 'canvas2d'],
	['canvas2d', 'webgl2'],
]

const percentile = (values: readonly number[], fraction: number) => {
	const sorted = [...values].sort((left, right) => left - right)
	return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? 0
}

const summarize = (values: readonly number[]) => ({
	mean: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length),
	median: percentile(values, 0.5),
	p95: percentile(values, 0.95),
	min: Math.min(...values),
	max: Math.max(...values),
})

const bootstrapMedian95 = (values: readonly number[]) => {
	if (values.length === 0) return null
	if (values.length === 1) return { low: values[0] ?? 0, high: values[0] ?? 0 }
	let state = 0x15c0ffee
	const next = () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0
		return state / 0x1_0000_0000
	}
	const medians: number[] = []
	for (let iteration = 0; iteration < 4000; iteration++) {
		const resample: number[] = []
		for (let index = 0; index < values.length; index++) {
			resample.push(values[Math.floor(next() * values.length)] ?? 0)
		}
		medians.push(percentile(resample, 0.5))
	}
	return { low: percentile(medians, 0.025), high: percentile(medians, 0.975) }
}

const metricNumber = async (page: import('@playwright/test').Page, id: string) => {
	const text = await page.locator(`[data-metric-id="${id}"]`).getAttribute('data-metric-value')
	const value = Number.parseFloat(text ?? '')
	if (!Number.isFinite(value)) throw new Error(`Metric '${id}' is not finite: ${text ?? '<missing>'}`)
	return value
}

const paritySample = async (page: import('@playwright/test').Page): Promise<ParitySample> => {
	const parity = page.locator('[data-stage15-parity="true"]')
	await expect(parity).toHaveCount(1)
	const value = async (attribute: string) => {
		const checksum = await parity.getAttribute(attribute)
		if (!checksum) throw new Error(`Missing Stage 15 parity attribute '${attribute}'.`)
		return checksum
	}
	return {
		simulationChecksum: await value('data-stage15-simulation-checksum'),
		renderViewChecksum: await value('data-stage15-render-view-checksum'),
		postRenderSimulationChecksum: await value('data-stage15-post-render-simulation-checksum'),
		postRenderViewChecksum: await value('data-stage15-post-render-view-checksum'),
	}
}

const webglIdentity = async (canvas: import('@playwright/test').Locator) => canvas.evaluate((element) => {
	const gl = (element as HTMLCanvasElement).getContext('webgl2')
	if (!gl) throw new Error('WebGL2 context is unavailable while collecting renderer identity.')
	const debug = gl.getExtension('WEBGL_debug_renderer_info') as {
		readonly UNMASKED_VENDOR_WEBGL: number
		readonly UNMASKED_RENDERER_WEBGL: number
	} | null
	const lineWidthRange = Array.from(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE) as Float32Array)
	return {
		version: String(gl.getParameter(gl.VERSION)),
		vendor: String(gl.getParameter(gl.VENDOR)),
		renderer: String(gl.getParameter(gl.RENDERER)),
		shadingLanguageVersion: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
		unmaskedVendor: debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : null,
		unmaskedRenderer: debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : null,
		aliasedLineWidthRange: lineWidthRange,
		timerQuerySupported: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2')),
	}
})

const advanceExactSteps = async (
	page: import('@playwright/test').Page,
	stepButton: import('@playwright/test').Locator,
	count: number,
) => {
	let remaining = count
	while (remaining > 0) {
		const batch = Math.min(12, remaining)
		await stepButton.evaluate((element, clicks) => {
			for (let index = 0; index < clicks; index++) (element as HTMLButtonElement).click()
		}, batch)
		remaining -= batch
		await page.waitForTimeout(5)
	}
}

const runWorkload = async (
	page: import('@playwright/test').Page,
	renderer: RendererId,
	workload: typeof STAGE_15_RENDERING_WORKLOADS[number],
) => {
	await page.goto(`/?stage15Benchmark=1#/lab/${workload.experimentId}`)
	await expect(page.locator('.badge')).toContainText(`seed · ${workload.seed}`)
	const rendererPicker = page.getByLabel('Renderer')
	if (renderer === 'webgl2') {
		await expect(rendererPicker.locator('option[value="webgl2"]')).toBeEnabled()
		await rendererPicker.selectOption('webgl2')
		await expect(page.locator('.badge')).toContainText('webgl2 · main')
	} else {
		await expect(rendererPicker).toHaveValue('canvas2d')
	}

	const dynamic = workload.experimentId !== 'scalar-field-2d'
	if (dynamic) await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled()
	for (const [parameterId, value] of Object.entries(workload.parameters)) {
		const input = page.locator(`#parameter-${parameterId}`)
		await input.fill(String(value))
		await expect(input).toHaveValue(String(value))
	}

	const canvas = page.locator('.simulation-canvas')
	for (const initialCondition of workload.initialConditions) {
		const box = await canvas.boundingBox()
		if (!box) throw new Error(`Canvas is unavailable for ${workload.id}.`)
		await canvas.click({
			position: {
				x: box.width * initialCondition.xFraction,
				y: box.height * initialCondition.yFraction,
			},
		})
	}

	if (dynamic) {
		const stepLabel = workload.experimentId === 'discrete-map-2d' ? 'Iterate' : 'Step'
		const stepButton = page.getByRole('button', { name: stepLabel, exact: true })
		await advanceExactSteps(page, stepButton, workload.minimumSimulationStep)
		await expect.poll(() => metricNumber(page, 'step')).toBe(workload.minimumSimulationStep)
		await page.waitForTimeout(workload.warmupMilliseconds)
	} else {
		await page.waitForTimeout(workload.warmupMilliseconds)
	}

	const rendererIdentity = renderer === 'webgl2' ? await webglIdentity(canvas) : null
	const gpuTimerSupported = rendererIdentity?.timerQuerySupported ?? false
	const samples: BenchmarkSample[] = []
	const stepButton = dynamic
		? page.getByRole('button', { name: workload.experimentId === 'discrete-map-2d' ? 'Iterate' : 'Step', exact: true })
		: undefined
	for (let sampleIndex = 0; sampleIndex < workload.sampleCount; sampleIndex++) {
		if (stepButton) {
			await stepButton.click()
			await expect.poll(() => metricNumber(page, 'step')).toBe(workload.minimumSimulationStep + sampleIndex + 1)
		} else {
			await page.waitForTimeout(110)
		}
		const sample: NumericSample = {}
		for (const metricId of CPU_TIMING_METRICS) sample[metricId] = await metricNumber(page, metricId)
		sample.gpuRenderMs = await metricNumber(page, 'gpuRenderMs')
		for (const metricId of STATE_METRICS_BY_EXPERIMENT[workload.experimentId]) {
			sample[metricId] = await metricNumber(page, metricId)
		}
		const parity = await paritySample(page)
		expect(parity.postRenderSimulationChecksum).toBe(parity.simulationChecksum)
		expect(parity.postRenderViewChecksum).toBe(parity.renderViewChecksum)
		samples.push({ ...sample, parity })
		if (stepButton) await page.waitForTimeout(8)
	}

	const timingSummary = Object.fromEntries(CPU_TIMING_METRICS.map((metricId) => [
		metricId,
		summarize(samples.map((sample) => sample[metricId] ?? 0)),
	]))
	const gpuSamples = samples.map((sample) => sample.gpuRenderMs ?? 0).filter((value) => value > 0)
	const canvasBox = await canvas.boundingBox()
	return {
		renderer,
		workload,
		canvasCssSize: canvasBox ? { width: canvasBox.width, height: canvasBox.height } : null,
		gpuTimerSupported,
		rendererIdentity,
		gpuTimingSampleCount: gpuSamples.length,
		gpuRenderMs: gpuSamples.length > 0 ? summarize(gpuSamples) : null,
		summary: timingSummary,
		samples,
	}
}

const combineRuns = (runs: readonly Awaited<ReturnType<typeof runWorkload>>[]) => {
	const samples = runs.flatMap(({ samples }) => samples)
	const gpuSamples = samples.map((sample) => sample.gpuRenderMs ?? 0).filter((value) => value > 0)
	return {
		renderer: runs[0]?.renderer,
		workload: runs[0]?.workload,
		canvasCssSize: runs[0]?.canvasCssSize ?? null,
		gpuTimerSupported: runs.some(({ gpuTimerSupported }) => gpuTimerSupported),
		rendererIdentity: runs.find(({ rendererIdentity }) => rendererIdentity)?.rendererIdentity ?? null,
		gpuTimingSampleCount: gpuSamples.length,
		gpuRenderMs: gpuSamples.length > 0 ? summarize(gpuSamples) : null,
		summary: Object.fromEntries(CPU_TIMING_METRICS.map((metricId) => [
			metricId,
			summarize(samples.map((sample) => sample[metricId] ?? 0)),
		])),
		runMedians: Object.fromEntries(CPU_TIMING_METRICS.map((metricId) => {
			const values = runs.map((run) => run.summary[metricId].median)
			return [metricId, {
				values,
				medianOfRunMedians: percentile(values, 0.5),
				bootstrapMedian95: bootstrapMedian95(values),
			}]
		})),
		samples,
	}
}

test('records the Stage 15C controlled Canvas2D/WebGL2 comparison', async ({ page, browser }) => {
	test.setTimeout(180_000 * REPEAT_COUNT)
	const results = []
	for (const workload of STAGE_15_RENDERING_WORKLOADS) {
		const runs: { readonly repeat: number; readonly order: readonly RendererId[]; readonly canvas2d: Awaited<ReturnType<typeof runWorkload>>; readonly webgl2: Awaited<ReturnType<typeof runWorkload>> }[] = []
		for (let repeat = 0; repeat < REPEAT_COUNT; repeat++) {
			const order = COUNTERBALANCED_ORDERS[repeat % COUNTERBALANCED_ORDERS.length] ?? COUNTERBALANCED_ORDERS[0]
			const byRenderer = {} as Record<RendererId, Awaited<ReturnType<typeof runWorkload>>>
			for (const renderer of order) byRenderer[renderer] = await runWorkload(page, renderer, workload)
			const canvas = byRenderer.canvas2d
			const webgl = byRenderer.webgl2
			expect(webgl.canvasCssSize).toEqual(canvas.canvasCssSize)
			const comparableState = (sample: BenchmarkSample) => Object.fromEntries(
			STATE_METRICS_BY_EXPERIMENT[workload.experimentId].map((metricId) => [metricId, sample[metricId]]),
			)
			expect(webgl.samples.map(comparableState)).toEqual(canvas.samples.map(comparableState))
			expect(webgl.samples.map(({ parity }) => parity.simulationChecksum)).toEqual(canvas.samples.map(({ parity }) => parity.simulationChecksum))
			expect(webgl.samples.map(({ parity }) => parity.renderViewChecksum)).toEqual(canvas.samples.map(({ parity }) => parity.renderViewChecksum))
			runs.push({ repeat: repeat + 1, order, canvas2d: canvas, webgl2: webgl })
		}
		const canvas2d = combineRuns(runs.map((run) => run.canvas2d))
		const webgl2 = combineRuns(runs.map((run) => run.webgl2))
		results.push({ workload, runs, canvas2d, webgl2 })
	}

	const output = {
		benchmark: process.env.STAGE15_BENCHMARK_NAME ?? 'Stage 15C controlled renderer comparison',
		version: STAGE_15_RENDERING_BENCHMARK_VERSION,
		measuredAt: new Date().toISOString(),
		runtime: 'main-thread',
		browser: `Chromium ${browser.version()}`,
		platform: `${os.platform()} ${os.release()} ${os.arch()}`,
		cpu: os.cpus()[0]?.model ?? 'unknown',
		logicalCpuCount: os.cpus().length,
		repeatCount: REPEAT_COUNT,
		counterbalancePattern: COUNTERBALANCED_ORDERS,
		gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
		trackedWorkingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().length > 0,
		viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
		parityProtocol: {
			dynamicExperiments: 'Start paused at step 0, apply identical parameters and inputs, advance to identical fixed-step indices, then measure one exact step per sample.',
			staticExperiment: 'Scalar Field keeps its ordinary render loop because the sampled mathematical state is static; sample/invalid counts must match.',
			stateCheck: 'Canvas2D and WebGL2 samples must match exposed state metrics plus canonical simulation and renderer-input checksums. Pre/post-render checksums must also match within each sample to detect renderer mutation.',
			terminology: 'This establishes mathematical/render-input parity. Pixel-identical rasterization is intentionally not required.',
		},
		statisticalProtocol: {
			order: 'Backend order is counterbalanced with an ABBA pattern across independent runs.',
			runSummary: 'Each backend reports pooled sample distributions plus per-run medians.',
			confidenceInterval: '95% deterministic bootstrap interval of run medians; interpret cautiously when repeatCount is small.',
		},
		timingSemantics: {
			simulationMs: 'Fixed-step CPU simulation work for the sampled step.',
			derivationMs: 'CPU derivation/sampling performed by the shared experiment session before renderer submission.',
			uploadMs: 'CPU representation conversion and CPU-to-GPU API upload/submission work; zero for Canvas2D.',
			renderMs: 'Synchronous renderer draw-call submission time on the CPU.',
			gpuRenderMs: 'Latest asynchronously completed EXT_disjoint_timer_query_webgl2 draw query; excluded from totalFrameMs because GPU work overlaps CPU execution.',
			totalFrameMs: 'CPU simulationMs + derivationMs + uploadMs + renderMs.',
		},
		results,
	}
	const destination = path.resolve(process.env.STAGE15_OUTPUT ?? 'docs/v2/stage-15c-renderer-comparison.json')
	await mkdir(path.dirname(destination), { recursive: true })
	await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
})
