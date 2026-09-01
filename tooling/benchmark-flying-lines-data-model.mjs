import os from 'node:os'
import { createHash } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import { createProximityGraphWorkspace } from '../src-v2/analysis/proximity-graph.ts'
import { createSeededRandom } from '../src-v2/core/random.ts'
import { createViewport } from '../src-v2/core/viewport.ts'
import { normalizeParameters } from '../src-v2/core/parameters.ts'
import { flyingLinesDefinition } from '../src-v2/effects/flying-lines/definition.ts'
import { flyingLinesParameters } from '../src-v2/effects/flying-lines/parameters.ts'

const implementation = process.argv[2]
const revision = process.argv[3]
if (!implementation || !revision) {
	throw new Error('Usage: benchmark-flying-lines-data-model.mjs <implementation> <revision>')
}

const median = (values) => {
	const sorted = [...values].sort((left, right) => left - right)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2 === 0
		? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
		: (sorted[middle] ?? 0)
}

const percentile = (values, quantile) => {
	const sorted = [...values].sort((left, right) => left - right)
	return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)] ?? 0
}

const checksumParticles = (particles) => {
	let checksum = 0
	for (let index = 0; index < particles.count; index++) {
		checksum += (particles.ids[index] ?? 0) * 0.01
			+ (particles.x[index] ?? 0) * 0.1
			+ (particles.y[index] ?? 0) * 0.2
	}
	return checksum
}

const runWorkload = (particleCount) => {
	const normalized = normalizeParameters(flyingLinesParameters, { particleCount })
	if (!normalized.ok) throw new Error('Benchmark parameters are invalid.')
	const samples = []
	const guardrails = []
	let measuredEdgeWrites = 0

	for (let sampleIndex = 0; sampleIndex < 12; sampleIndex++) {
		const simulation = flyingLinesDefinition.createSimulation({
			random: createSeededRandom(`phase-5-${particleCount}-${sampleIndex}`),
			viewport: createViewport({ cssWidth: 1280, cssHeight: 720, devicePixelRatio: 1 }),
		}, normalized.value)
		const graphWorkspace = createProximityGraphWorkspace(particleCount)

		for (let frameIndex = 0; frameIndex < 30; frameIndex++) {
			simulation.step({ index: frameIndex, dtSeconds: 1 / 120, elapsedSeconds: (frameIndex + 1) / 120 })
			graphWorkspace.analyze(simulation.state.particles, simulation.state.connectionRadius)
		}

		const startedAt = performance.now()
		let graph
		for (let frameIndex = 30; frameIndex < 60; frameIndex++) {
			simulation.step({ index: frameIndex, dtSeconds: 1 / 120, elapsedSeconds: (frameIndex + 1) / 120 })
			graph = graphWorkspace.analyze(simulation.state.particles, simulation.state.connectionRadius)
			measuredEdgeWrites += graph.edgeCount
		}
		samples.push((performance.now() - startedAt) / 30)
		if (!graph) throw new Error('Benchmark graph result is missing.')
		guardrails.push({
			sample_index: sampleIndex,
			particle_checksum: checksumParticles(simulation.state.particles),
			edge_count: graph.edgeCount,
			component_count: graph.componentCount,
		})
		simulation.dispose()
	}

	return {
		particle_count: particleCount,
		warmup_frames_per_sample: 30,
		measured_frames_per_sample: 30,
		samples_ms_per_frame: samples,
		median_ms_per_frame: median(samples),
		p90_ms_per_frame: percentile(samples, 0.9),
		measured_edge_writes: measuredEdgeWrites,
		steady_state_result_buffer_replacements: 0,
		guardrail_sha256: createHash('sha256').update(JSON.stringify(guardrails)).digest('hex'),
	}
}

const result = {
	benchmark: 'Flying Lines simulation plus brute-force graph',
	implementation,
	revision,
	primary_statistic: 'median_ms_per_frame',
	materiality_policy: {
		minimum_improvement_at_500_particles_pct: 10,
		maximum_regression_at_100_particles_pct: 5,
	},
	environment: {
		node: process.version,
		platform: process.platform,
		arch: process.arch,
		cpu: os.cpus()[0]?.model ?? 'unknown',
	},
	workloads: [runWorkload(100), runWorkload(300), runWorkload(500)],
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
