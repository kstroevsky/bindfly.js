import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import {
	STAGE_15_RENDERING_BENCHMARK_VERSION,
	STAGE_15_RENDERING_WORKLOADS,
} from '../../src-v2/benchmarks/stage-15-rendering-workloads.ts'

const TIMING_METRICS = ['simulationMs', 'derivationMs', 'uploadMs', 'renderMs', 'totalFrameMs'] as const

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

test('records the Stage 15A Canvas2D baseline', async ({ page, browser }) => {
	test.setTimeout(180_000)
	const results = []
	for (const workload of STAGE_15_RENDERING_WORKLOADS) {
		await page.goto(`/#/lab/${workload.experimentId}`)
		await expect(page.locator('.badge')).toContainText(`seed · ${workload.seed}`)
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

		if (workload.minimumSimulationStep > 0) {
			await expect.poll(() => metricNumber(page, 'step'), { timeout: 30_000 }).toBeGreaterThanOrEqual(workload.minimumSimulationStep)
		}
		await page.waitForTimeout(workload.warmupMilliseconds)

		const samples = []
		for (let sampleIndex = 0; sampleIndex < workload.sampleCount; sampleIndex++) {
			const sample: Record<string, number> = {}
			for (const metricId of TIMING_METRICS) sample[metricId] = await metricNumber(page, metricId)
			sample.points = await metricNumber(page, 'points')
			sample.edges = await metricNumber(page, 'edges')
			samples.push(sample)
			await page.waitForTimeout(110)
		}

		const timingSummary = Object.fromEntries(TIMING_METRICS.map((metricId) => [
			metricId,
			summarize(samples.map((sample) => sample[metricId] ?? 0)),
		]))
		const canvasBox = await canvas.boundingBox()
		results.push({
			workload,
			canvasCssSize: canvasBox ? { width: canvasBox.width, height: canvasBox.height } : null,
			summary: timingSummary,
			samples,
		})
	}

	const output = {
		benchmark: 'Stage 15A Canvas2D rendering baseline',
		version: STAGE_15_RENDERING_BENCHMARK_VERSION,
		measuredAt: new Date().toISOString(),
		renderer: 'canvas2d',
		runtime: 'main-thread',
		browser: `Chromium ${browser.version()}`,
		platform: `${os.platform()} ${os.release()} ${os.arch()}`,
		cpu: os.cpus()[0]?.model ?? 'unknown',
		logicalCpuCount: os.cpus().length,
		gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
		trackedWorkingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim().length > 0,
		viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
		timingSemantics: {
			simulationMs: 'Fixed-step simulation work accumulated since the previous rendered frame.',
			derivationMs: 'CPU derivation/sampling performed by the experiment session before renderer submission.',
			uploadMs: 'CPU-to-GPU upload time; zero for Canvas2D.',
			renderMs: 'Synchronous renderer submission/call duration.',
			totalFrameMs: 'simulationMs + derivationMs + uploadMs + renderMs.',
		},
		results,
	}
	const destination = path.resolve('docs/v2/stage-15a-canvas-benchmark.json')
	await mkdir(path.dirname(destination), { recursive: true })
	await writeFile(destination, `${JSON.stringify(output, null, 2)}\n`, 'utf8')
})
