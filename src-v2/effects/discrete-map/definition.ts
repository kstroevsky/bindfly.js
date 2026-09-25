import { defineExperiment, normalizeParameters } from '../../core/index.ts'
import type { ExperimentStateCodec } from '../../core/index.ts'

import { compileDiscreteMapPrograms, createDiscreteMapScope, evaluateDiscreteMap } from './formula.ts'
import { discreteMapParameters } from './parameters.ts'
import { createDiscreteMapSimulation, snapshotDiscreteMapState } from './simulation.ts'
import type { DiscreteMapInput, DiscreteMapParameters, DiscreteMapState } from './types.ts'

export interface DiscreteMapDurableState {
	readonly parameters: DiscreteMapParameters
	readonly seed: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const codec: ExperimentStateCodec<DiscreteMapDurableState, string> = {
	currentVersion: 1,
	serialize: (state) => JSON.stringify(state),
	parse: (serialized) => {
		if (typeof serialized !== 'string') return { ok: false, error: 'Discrete-map state must be a string.' }
		try {
			const value = JSON.parse(serialized) as unknown
			if (!isRecord(value) || typeof value.seed !== 'string' || value.seed.length === 0) {
				return { ok: false, error: 'Discrete-map state requires an object and non-empty seed.' }
			}
			const normalized = normalizeParameters(discreteMapParameters, value.parameters)
			if (!normalized.ok) return { ok: false, error: normalized.issues[0]?.message ?? 'Invalid discrete-map parameters.' }
			const compiled = compileDiscreteMapPrograms(normalized.value)
			if (!compiled.ok) return compiled
			return { ok: true, value: { parameters: normalized.value, seed: value.seed } }
		} catch {
			return { ok: false, error: 'Discrete-map state is not valid JSON.' }
		}
	},
	migrate: (serialized, context) => context.fromVersion === context.toVersion
		? { ok: true, value: serialized }
		: { ok: false, error: `No discrete-map migration from ${context.fromVersion} to ${context.toVersion}.` },
}

const defaults = normalizeParameters(discreteMapParameters, {})
if (!defaults.ok) throw new Error('Discrete-map defaults are invalid.')

export const discreteMapDefinition = defineExperiment<
	typeof discreteMapParameters,
	DiscreteMapState,
	DiscreteMapInput,
	DiscreteMapDurableState,
	string,
	DiscreteMapState
>({
	id: 'discrete-map-2d',
	stateVersion: 1,
	timing: { fixedStepSeconds: 1 / 12, deterministicTier: 'same-build-cpu', stateTolerance: 0 },
	parameters: discreteMapParameters,
	stateCodec: codec,
	capabilities: {
		executionProfiles: [{ rendererId: 'canvas2d', runtimeId: 'main-thread' }],
		snapshotState: snapshotDiscreteMapState,
	},
	presets: [{
		id: 'henon',
		name: 'Hénon map',
		parameters: defaults.value,
	}],
	createSimulation: (environment, parameters) => {
		const programs = compileDiscreteMapPrograms(parameters)
		if (!programs.ok) throw new Error(programs.error)
		return createDiscreteMapSimulation({
			parameters,
			viewport: environment.viewport,
			evaluate: (x, y, n) => evaluateDiscreteMap(
				programs.value,
				createDiscreteMapScope(parameters, x, y, n),
			),
		})
	},
})
