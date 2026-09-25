import type { Result } from '../../../src-v2/core/index.ts'
import { scalarFieldDefinition } from '../../../src-v2/effects/scalar-field/definition.ts'
import { compileScalarFieldProgram } from '../../../src-v2/effects/scalar-field/formula.ts'
import type { ScalarFieldInput } from '../../../src-v2/effects/scalar-field/types.ts'
import { createScalarFieldSession } from './scalar-field-session.ts'
import type { ScalarFieldProbe } from './scalar-field-session.ts'
import { defineStudioExperiment } from './studio-experiment-plugin.ts'

const parseInput = (_value: unknown): Result<ScalarFieldInput, string> => ({
	ok: false,
	error: 'Scalar fields do not accept simulation input.',
})

export const scalarFieldPlugin = defineStudioExperiment({
	definition: scalarFieldDefinition,
	title: 'Scalar Field Lab',
	defaultSeed: 'scalar-field-radial-v1',
	temporalSemantics: { kind: 'static' },
	metrics: [
		{ id: 'points', label: 'Samples' },
		{ id: 'edges', label: 'Invalid samples' },
		{ id: 'frameMs', label: 'Frame', format: (value) => `${Number(value).toFixed(1)} ms` },
	],
	createSession: createScalarFieldSession,
	createInteractionController: () => ({ handle: () => [] as ScalarFieldInput[] }),
	parseInput,
	validateParameters: (parameters) => {
		const compiled = compileScalarFieldProgram(parameters)
		return compiled.ok ? { ok: true, value: undefined } : compiled
	},
	formatPointInspection: (value) => {
		if (typeof value !== 'object' || value === null || !('kind' in value)) return undefined
		const probe = value as ScalarFieldProbe
		if (probe.kind !== 'scalar-field-probe') return undefined
		return {
			title: 'Formula Probe · scalar field',
			sections: [
				{ title: 'Point', rows: [
					{ label: 'x', value: probe.x.toFixed(6) },
					{ label: 'y', value: probe.y.toFixed(6) },
					{ label: 'z', value: probe.error ?? probe.value?.toFixed(6) ?? 'invalid' },
				] },
				{ title: 'Trace · z', rows: probe.trace.map((entry) => ({ label: entry.expression, value: entry.value.toFixed(6) })) },
			],
		}
	},
	toDurableState: (parameters, seed) => ({ parameters, seed }),
	fromDurableState: (state) => state,
})

export default scalarFieldPlugin
