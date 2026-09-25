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

const metricNumber = async (page: import('@playwright/test').Page, id: string) => {
	const text = await page.locator(`[data-metric-id="${id}"]`).getAttribute('data-metric-value')
	const value = Number.parseFloat(text ?? '')
	if (!Number.isFinite(value)) throw new Error(`Metric '${id}' is not finite: ${text ?? '<missing>'}`)
	return value
}

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

	const gpuTimerSupported = renderer === 'webgl2'
		? await canvas.evaluate((element) => Boolean(
			(element as HTMLCanvasElement).getContext('webgl2')?.getExtension('EXT_disjoint_timer_query_webgl2'),
		))
		: false
	const samples: Record<string, number>[] = []
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
		const sample: Record<string, number> = {}
		for (const metricId of CPU_TIMING_METRICS) sample[metricId] = await metricNumber(page, metricId)
		sample.gpuRenderMs = await metricNumber(page, 'gpuRenderMs')
		for (const metricId of STATE_METRICS_BY_EXPERIMENT[workload.experimentId]) {
			sample[metricId] = await metricNumber(page, metricId)
		}
		samples.push(sample)
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
		gpuTimingSampleCount: gpuSamples.length,
		gpuRenderMs: gpuSamples.length > 0 ? summarize(gpuSamples) : null,
		summary: timingSummary,
		samples,
	}
}

test('records the Stage 15C controlled Canvas2D/WebGL2 comparison', async ({ page, browser }) => {
	test.setTimeout(180_000)
	const results = []
	for (const workload of STAGE_15_RENDERING_WORKLOADS) {
		const canvas = await runWorkload(page, 'canvas2d', workload)
		const webgl = await runWorkload(page, 'webgl2', workload)
		expect(webgl.canvasCssSize).toEqual(canvas.canvasCssSize)
		const comparableState = (sample: Record<string, number>) => Object.fromEntries(
			STATE_METRICS_BY_EXPERIMENT[workload.experimentId].map((metricId) => [metricId, sample[metricId]]),
		)
		expect(webgl.samples.map(comparableState)).toEqual(canvas.samples.map(comparableState))
		results.push({ workload, canvas2d: canvas, webgl2: webgl })
	}

	const output = {
		benchmark: 'Stage 15C controlled renderer comparison',
		version: STAGE_15_RENDERING_BENCHMARK_VERSION,
		measuredAt: new Date().toISOString(),
		runtime: 'main-thread',
		browser: `Chromium ${browser.version()}`,
		platform: `${os.platform()} ${os.release()} ${os.arch()}`,
		cpu: os.cpus()[0]?.model ?? 'unknown',
		logicalCpuCount: os.cpus().length,
		gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
		trackedWorkingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().length > 0,
		viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
		parityProtocol: {
			dynamicExperiments: 'Start paused at step 0, apply identical parameters and inputs, advance to identical fixed-step indices, then measure one exact step per sample.',
			staticExperiment: 'Scalar Field keeps its ordinary render loop because the sampled mathematical state is static; sample/invalid counts must match.',
			stateCheck: 'Canvas2D and WebGL2 samples must match every state metric exposed by the experiment: step/points/edges/components for Flying Lines, step/points/edges for Vector Field and Discrete Map, and points/edges for Scalar Field.',
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
	const destination = path.resolve('docs/v2/stage-15c-renderer-comparison.json')
	await mkdir(path.dirname(destination), { recursive: true })
	await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
})
