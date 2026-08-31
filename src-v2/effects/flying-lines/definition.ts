import { defineExperiment, normalizeParameters } from '../../core/index.ts'
import type { ExperimentStateCodec } from '../../core/index.ts'

import { flyingLinesParameters } from './parameters.ts'
import { createFlyingLinesSimulation } from './simulation.ts'
import type { FlyingLinesInput, FlyingLinesParameters, FlyingLinesState } from './types.ts'

export interface FlyingLinesDurableState {
	readonly parameters: FlyingLinesParameters
	readonly seed: string
}

const codec: ExperimentStateCodec<FlyingLinesDurableState, string> = {
	currentVersion: 1,
	serialize: (state) => JSON.stringify(state),
	parse: (serialized) => {
		if (typeof serialized !== 'string') return { ok: false, error: 'Flying Lines state must be a string.' }

		try {
			const value = JSON.parse(serialized) as unknown
			if (typeof value !== 'object' || value === null || Array.isArray(value)) {
				return { ok: false, error: 'Flying Lines state must decode to an object.' }
			}
			const record = value as Record<string, unknown>
			if (typeof record.seed !== 'string' || record.seed.length === 0) {
				return { ok: false, error: 'Flying Lines state requires a non-empty seed.' }
			}
			const parameters = normalizeParameters(flyingLinesParameters, record.parameters)
			if (!parameters.ok) {
				return { ok: false, error: `Flying Lines parameters are invalid: ${parameters.issues[0]?.message ?? 'unknown issue'}` }
			}
			return { ok: true, value: { seed: record.seed, parameters: parameters.value } }
		} catch {
			return { ok: false, error: 'Flying Lines state is not valid JSON.' }
		}
	},
	migrate: (serialized, context) => context.fromVersion === context.toVersion
		? { ok: true, value: serialized }
		: { ok: false, error: `No Flying Lines migration from ${context.fromVersion} to ${context.toVersion}.` },
}

const defaultParametersResult = normalizeParameters(flyingLinesParameters, {})
if (!defaultParametersResult.ok) throw new Error('Flying Lines defaults are invalid.')
const defaultParameters = defaultParametersResult.value

export const flyingLinesDefinition = defineExperiment<
	typeof flyingLinesParameters,
	FlyingLinesState,
	FlyingLinesInput,
	FlyingLinesDurableState,
	string
>({
	id: 'flying-lines',
	stateVersion: 1,
	timing: {
		fixedStepSeconds: 1 / 120,
		deterministicTier: 'same-build-cpu',
		stateTolerance: 1e-9,
	},
	parameters: flyingLinesParameters,
	stateCodec: codec,
	capabilities: {
		renderers: ['canvas2d'],
		runtimes: ['main-thread'],
		snapshotState: (state) => ({
			...state,
			particles: state.particles.map((particle) => ({ ...particle })),
		}),
	},
	presets: [
		{
			id: 'simple',
			name: 'Simple',
			parameters: defaultParameters,
		},
	],
	createSimulation: (environment, parameters) => createFlyingLinesSimulation({ environment, parameters }),
})

export default flyingLinesDefinition
