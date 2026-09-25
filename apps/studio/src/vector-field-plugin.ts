import type { Result } from '../../../src-v2/core/index.ts'
import { vectorFieldDefinition } from '../../../src-v2/effects/vector-field/definition.ts'
import { compileVectorFieldPrograms } from '../../../src-v2/effects/vector-field/formula.ts'
import type { VectorFieldInput } from '../../../src-v2/effects/vector-field/types.ts'
import { createVectorFieldSession } from './vector-field-session.ts'
import type { VectorFieldProbe } from './vector-field-session.ts'
import { defineStudioExperiment } from './studio-experiment-plugin.ts'
import type { StudioInteractionController } from './studio-experiment-plugin.ts'

const parseInput = (value: unknown): Result<VectorFieldInput, string> => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return { ok: false, error: 'Vector-field input must be an object.' }
	}
	const record = value as Record<string, unknown>
	return record.type === 'add-initial-condition'
		&& typeof record.x === 'number' && Number.isFinite(record.x)
		&& typeof record.y === 'number' && Number.isFinite(record.y)
		? { ok: true, value: { type: 'add-initial-condition', x: record.x, y: record.y } }
		: { ok: false, error: 'Vector-field input must add one finite initial condition.' }
}

const createInteractionController = (): StudioInteractionController => ({
	handle: (event) => event.phase === 'down'
		? [{ type: 'add-initial-condition', x: event.x, y: event.y }]
		: [],
})

const formatAxis = (axis: VectorFieldProbe['dx']) => axis.error ?? axis.value?.toFixed(6) ?? 'invalid'

export const vectorFieldPlugin = defineStudioExperiment({
	definition: vectorFieldDefinition,
	title: 'Vector Field Lab',
	defaultSeed: 'vector-field-hopf-v1',
	metrics: [
		{ id: 'points', label: 'Trajectories' },
		{ id: 'edges', label: 'Field samples' },
		{ id: 'step', label: 'Step' },
		{ id: 'frameMs', label: 'Frame', format: (value) => `${Number(value).toFixed(1)} ms` },
	],
	createSession: createVectorFieldSession,
	createInteractionController,
	parseInput,
	validateParameters: (parameters) => {
		const compiled = compileVectorFieldPrograms(parameters)
		return compiled.ok ? { ok: true, value: undefined } : compiled
	},
	formatPointInspection: (value) => {
		if (typeof value !== 'object' || value === null || !('kind' in value)) return undefined
		const probe = value as VectorFieldProbe
		if (probe.kind !== 'vector-field-probe') return undefined
		return {
			title: 'Formula Probe · vector field',
			sections: [
				{ title: 'Point', rows: [
					{ label: 'x', value: probe.x.toFixed(6) },
					{ label: 'y', value: probe.y.toFixed(6) },
					{ label: 't', value: probe.t.toFixed(6) },
					{ label: 'dx/dt', value: formatAxis(probe.dx) },
					{ label: 'dy/dt', value: formatAxis(probe.dy) },
				] },
				{ title: 'Trace · dx/dt', rows: probe.dx.trace.map((entry) => ({ label: entry.expression, value: entry.value.toFixed(6) })) },
				{ title: 'Trace · dy/dt', rows: probe.dy.trace.map((entry) => ({ label: entry.expression, value: entry.value.toFixed(6) })) },
			],
		}
	},
	toDurableState: (parameters, seed) => ({ parameters, seed }),
	fromDurableState: (state) => state,
})

export default vectorFieldPlugin
