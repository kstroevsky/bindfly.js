import { defineExperiment, normalizeParameters } from '../../core/index.ts'
import type { ExperimentStateCodec } from '../../core/index.ts'

import { compileVectorFieldPrograms, createVectorFieldScope, evaluateVectorField } from './formula.ts'
import { vectorFieldParameters } from './parameters.ts'
import { createVectorFieldSimulation, snapshotVectorFieldState } from './simulation.ts'
import type { VectorFieldInput, VectorFieldParameters, VectorFieldState } from './types.ts'

export interface VectorFieldDurableState {
	readonly parameters: VectorFieldParameters
	readonly seed: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const codec: ExperimentStateCodec<VectorFieldDurableState, string> = {
	currentVersion: 1,
	serialize: (state) => JSON.stringify(state),
	parse: (serialized) => {
		if (typeof serialized !== 'string') return { ok: false, error: 'Vector-field state must be a string.' }
		try {
			const value = JSON.parse(serialized) as unknown
			if (!isRecord(value) || typeof value.seed !== 'string' || value.seed.length === 0) {
				return { ok: false, error: 'Vector-field state requires an object and non-empty seed.' }
			}
			const normalized = normalizeParameters(vectorFieldParameters, value.parameters)
			if (!normalized.ok) return { ok: false, error: normalized.issues[0]?.message ?? 'Invalid vector-field parameters.' }
			const compiled = compileVectorFieldPrograms(normalized.value)
			if (!compiled.ok) return compiled
			return { ok: true, value: { parameters: normalized.value, seed: value.seed } }
		} catch {
			return { ok: false, error: 'Vector-field state is not valid JSON.' }
		}
	},
	migrate: (serialized, context) => context.fromVersion === context.toVersion
		? { ok: true, value: serialized }
		: { ok: false, error: `No vector-field migration from ${context.fromVersion} to ${context.toVersion}.` },
}

const defaults = normalizeParameters(vectorFieldParameters, {})
if (!defaults.ok) throw new Error('Vector-field defaults are invalid.')

export const vectorFieldDefinition = defineExperiment<
	typeof vectorFieldParameters,
	VectorFieldState,
	VectorFieldInput,
	VectorFieldDurableState,
	string,
	VectorFieldState
>({
	id: 'vector-field-2d',
	stateVersion: 1,
	timing: { fixedStepSeconds: 1 / 60, deterministicTier: 'same-build-cpu', stateTolerance: 1e-9 },
	parameters: vectorFieldParameters,
	stateCodec: codec,
	capabilities: {
		executionProfiles: [
			{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
			{ rendererId: 'canvas2d', runtimeId: 'worker' },
		],
		snapshotState: snapshotVectorFieldState,
	},
	presets: [{
		id: 'hopf',
		name: 'Hopf normal form',
		parameters: defaults.value,
	}],
	createSimulation: (environment, parameters) => {
		const programs = compileVectorFieldPrograms(parameters)
		if (!programs.ok) throw new Error(programs.error)
		return createVectorFieldSimulation({
			parameters,
			viewport: environment.viewport,
			evaluate: (x, y, t) => evaluateVectorField(
				programs.value,
				createVectorFieldScope(parameters, x, y, t),
			),
		})
	},
})
