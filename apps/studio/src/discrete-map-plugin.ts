import type { Result } from '../../../src-v2/core/index.ts'
import { discreteMapDefinition } from '../../../src-v2/effects/discrete-map/definition.ts'
import { compileDiscreteMapPrograms } from '../../../src-v2/effects/discrete-map/formula.ts'
import type { DiscreteMapInput } from '../../../src-v2/effects/discrete-map/types.ts'
import { createDiscreteMapSession } from './discrete-map-session.ts'
import type { DiscreteMapProbe } from './discrete-map-session.ts'
import { defineStudioExperiment } from './studio-experiment-plugin.ts'
import type { StudioInteractionController } from './studio-experiment-plugin.ts'

const parseInput = (value: unknown): Result<DiscreteMapInput, string> => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return { ok: false, error: 'Discrete-map input must be an object.' }
	}
	const record = value as Record<string, unknown>
	return record.type === 'add-initial-condition'
		&& typeof record.x === 'number' && Number.isFinite(record.x)
		&& typeof record.y === 'number' && Number.isFinite(record.y)
		? { ok: true, value: { type: 'add-initial-condition', x: record.x, y: record.y } }
		: { ok: false, error: 'Discrete-map input must add one finite initial condition.' }
}

const createInteractionController = (): StudioInteractionController => ({
	handle: (event) => event.phase === 'down'
		? [{ type: 'add-initial-condition', x: event.x, y: event.y }]
		: [],
})

const formatAxis = (axis: DiscreteMapProbe['nextX']) => axis.error ?? axis.value?.toFixed(6) ?? 'invalid'

export const discreteMapPlugin = defineStudioExperiment({
	definition: discreteMapDefinition,
	title: 'Discrete Map Lab',
	defaultSeed: 'henon-map-v1',
	metrics: [
		{ id: 'points', label: 'Orbits' },
		{ id: 'edges', label: 'Iteration' },
		{ id: 'step', label: 'Step' },
		{ id: 'frameMs', label: 'Frame', format: (value) => `${Number(value).toFixed(1)} ms` },
	],
	createSession: createDiscreteMapSession,
	createInteractionController,
	parseInput,
	validateParameters: (parameters) => {
		const compiled = compileDiscreteMapPrograms(parameters)
		return compiled.ok ? { ok: true, value: undefined } : compiled
	},
	formatPointInspection: (value) => {
		if (typeof value !== 'object' || value === null || !('kind' in value)) return undefined
		const probe = value as DiscreteMapProbe
		if (probe.kind !== 'discrete-map-probe') return undefined
		return {
			title: 'Formula Probe · discrete map',
			sections: [
				{ title: 'Point', rows: [
					{ label: 'x[n]', value: probe.x.toFixed(6) },
					{ label: 'y[n]', value: probe.y.toFixed(6) },
					{ label: 'n', value: String(probe.n) },
					{ label: 'x[n+1]', value: formatAxis(probe.nextX) },
					{ label: 'y[n+1]', value: formatAxis(probe.nextY) },
				] },
				{ title: 'Trace · x[n+1]', rows: probe.nextX.trace.map((entry) => ({ label: entry.expression, value: entry.value.toFixed(6) })) },
				{ title: 'Trace · y[n+1]', rows: probe.nextY.trace.map((entry) => ({ label: entry.expression, value: entry.value.toFixed(6) })) },
			],
		}
	},
	toDurableState: (parameters, seed) => ({ parameters, seed }),
	fromDurableState: (state) => state,
})

export default discreteMapPlugin
