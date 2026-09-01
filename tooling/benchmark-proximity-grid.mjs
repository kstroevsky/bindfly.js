import { performance } from 'node:perf_hooks'

import { createProximityGraphWorkspace } from '../src-v2/analysis/proximity-graph.ts'
import { createUniformGridProximityGraphWorkspace } from '../src-v2/analysis/uniform-grid-proximity-graph.ts'
import { createSeededRandom } from '../src-v2/core/random.ts'
import { createViewport } from '../src-v2/core/viewport.ts'
import { normalizeParameters } from '../src-v2/core/parameters.ts'
import { flyingLinesDefinition } from '../src-v2/effects/flying-lines/definition.ts'
import { flyingLinesParameters } from '../src-v2/effects/flying-lines/parameters.ts'

const median = (values) => {
	const sorted = [...values].sort((left, right) => left - right)
	const middle = Math.floor(sorted.length / 2)
	return (sorted[middle - 1] + sorted[middle]) / 2
}

const run = (particleCount, connectionRadius) => {
	const parameters = normalizeParameters(flyingLinesParameters, { particleCount, connectionRadius })
	if (!parameters.ok) throw new Error('Benchmark parameters are invalid.')
	const simulation = flyingLinesDefinition.createSimulation({
		random: createSeededRandom(`phase-6-${particleCount}-${connectionRadius}`),
		viewport: createViewport({ cssWidth: 1280, cssHeight: 720, devicePixelRatio: 1 }),
	}, parameters.value)
	const brute = createProximityGraphWorkspace(500)
	const grid = createUniformGridProximityGraphWorkspace(500)
	const bruteSamples = []
	const gridSamples = []
	for (let sample = 0; sample < 12; sample++) {
		for (let frame = 0; frame < 20; frame++) simulation.step({ index: frame, dtSeconds: 1 / 120, elapsedSeconds: (frame + 1) / 120 })
		const measure = (workspace, samples) => {
			const startedAt = performance.now()
			for (let frame = 0; frame < 30; frame++) workspace.analyze(simulation.state.particles, connectionRadius)
			samples.push((performance.now() - startedAt) / 30)
		}
		if (sample % 2 === 0) { measure(brute, bruteSamples); measure(grid, gridSamples) }
		else { measure(grid, gridSamples); measure(brute, bruteSamples) }
	}
	const bruteMedian = median(bruteSamples)
	const gridMedian = median(gridSamples)
	return {
		particle_count: particleCount,
		connection_radius: connectionRadius,
		brute_samples_ms: bruteSamples,
		grid_samples_ms: gridSamples,
		brute_median_ms: bruteMedian,
		grid_median_ms: gridMedian,
		grid_improvement_pct: (bruteMedian - gridMedian) / bruteMedian * 100,
		edge_count: grid.result.edgeCount,
	}
}

const result = {
	benchmark: 'Reusable brute-force versus uniform-grid proximity graph',
	policy: { minimum_default_500_improvement_pct: 15, maximum_any_regression_pct: 10 },
	workloads: [
		run(100, 50), run(100, 250),
		run(300, 50), run(300, 250),
		run(500, 50), run(500, 100), run(500, 250),
	],
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
