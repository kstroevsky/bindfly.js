import os from 'node:os'
import { performance } from 'node:perf_hooks'

import { createSeededRandom } from '../src-v2/core/random.ts'
import { createViewport } from '../src-v2/core/viewport.ts'
import { normalizeParameters } from '../src-v2/core/parameters.ts'
import { flyingLinesDefinition } from '../src-v2/effects/flying-lines/definition.ts'
import { flyingLinesParameters } from '../src-v2/effects/flying-lines/parameters.ts'

const median = (values) => {
	const sorted = [...values].sort((left, right) => left - right)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2 === 0
		? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
		: (sorted[middle] ?? 0)
}

const run = (particleCount) => {
	const normalized = normalizeParameters(flyingLinesParameters, { particleCount })
	if (!normalized.ok) throw new Error('Benchmark parameters are invalid.')
	const simulation = flyingLinesDefinition.createSimulation({
		random: createSeededRandom(`phase-4-benchmark-${particleCount}`),
		viewport: createViewport({ cssWidth: 1280, cssHeight: 720, devicePixelRatio: 1 }),
	}, normalized.value)
	const stepSeconds = flyingLinesDefinition.timing.fixedStepSeconds
	let stepIndex = 0
	const step = () => {
		simulation.step({
			index: stepIndex,
			dtSeconds: stepSeconds,
			elapsedSeconds: (stepIndex + 1) * stepSeconds,
		})
		stepIndex++
	}

	for (let index = 0; index < 1_000; index++) step()
	const batchMilliseconds = []
	for (let batch = 0; batch < 20; batch++) {
		const startedAt = performance.now()
		for (let index = 0; index < 1_000; index++) step()
		batchMilliseconds.push(performance.now() - startedAt)
	}
	simulation.dispose()

	const medianBatchMilliseconds = median(batchMilliseconds)
	return {
		particle_count: particleCount,
		warmup_steps: 1_000,
		batch_count: batchMilliseconds.length,
		steps_per_batch: 1_000,
		batch_milliseconds: batchMilliseconds,
		median_batch_milliseconds: medianBatchMilliseconds,
		median_step_milliseconds: medianBatchMilliseconds / 1_000,
	}
}

const result = {
	benchmark: 'Flying Lines simulation step only',
	clock_policy: {
		fixed_step_seconds: flyingLinesDefinition.timing.fixedStepSeconds,
		step_hz: 1 / flyingLinesDefinition.timing.fixedStepSeconds,
		state_tolerance: flyingLinesDefinition.timing.stateTolerance,
		deterministic_tier: flyingLinesDefinition.timing.deterministicTier,
	},
	environment: {
		node: process.version,
		platform: process.platform,
		arch: process.arch,
		cpu: os.cpus()[0]?.model ?? 'unknown',
	},
	workloads: [run(100), run(500)],
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
