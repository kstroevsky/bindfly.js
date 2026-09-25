import { defineExperiment, normalizeParameters } from '../../core/index.ts'
import type { ExperimentStateCodec } from '../../core/index.ts'

import { compileScalarFieldProgram } from './formula.ts'
import { scalarFieldParameters } from './parameters.ts'
import { createScalarFieldSimulation, snapshotScalarFieldState } from './simulation.ts'
import type { ScalarFieldInput, ScalarFieldParameters, ScalarFieldState } from './types.ts'

export interface ScalarFieldDurableState {
	readonly parameters: ScalarFieldParameters
	readonly seed: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const codec: ExperimentStateCodec<ScalarFieldDurableState, string> = {
	currentVersion: 1,
	serialize: (state) => JSON.stringify(state),
	parse: (serialized) => {
		if (typeof serialized !== 'string') return { ok: false, error: 'Scalar-field state must be a string.' }
		try {
			const value = JSON.parse(serialized) as unknown
			if (!isRecord(value) || typeof value.seed !== 'string' || value.seed.length === 0) {
				return { ok: false, error: 'Scalar-field state requires an object and non-empty seed.' }
			}
			const normalized = normalizeParameters(scalarFieldParameters, value.parameters)
			if (!normalized.ok) return { ok: false, error: normalized.issues[0]?.message ?? 'Invalid scalar-field parameters.' }
			const compiled = compileScalarFieldProgram(normalized.value)
			if (!compiled.ok) return compiled
			return { ok: true, value: { parameters: normalized.value, seed: value.seed } }
		} catch {
			return { ok: false, error: 'Scalar-field state is not valid JSON.' }
		}
	},
	migrate: (serialized, context) => context.fromVersion === context.toVersion
		? { ok: true, value: serialized }
		: { ok: false, error: `No scalar-field migration from ${context.fromVersion} to ${context.toVersion}.` },
}

const defaults = normalizeParameters(scalarFieldParameters, {})
if (!defaults.ok) throw new Error('Scalar-field defaults are invalid.')

export const scalarFieldDefinition = defineExperiment<
	typeof scalarFieldParameters,
	ScalarFieldState,
	ScalarFieldInput,
	ScalarFieldDurableState,
	string,
	ScalarFieldState
>({
	id: 'scalar-field-2d',
	stateVersion: 1,
	timing: { fixedStepSeconds: 1 / 60, deterministicTier: 'same-build-cpu', stateTolerance: 0 },
	parameters: scalarFieldParameters,
	stateCodec: codec,
	capabilities: {
		executionProfiles: [
			{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
			{ rendererId: 'canvas2d', runtimeId: 'worker' },
		],
		snapshotState: snapshotScalarFieldState,
	},
	presets: [{ id: 'radial-level-set', name: 'Radial level set', parameters: defaults.value }],
	createSimulation: (_environment, parameters) => {
		const program = compileScalarFieldProgram(parameters)
		if (!program.ok) throw new Error(program.error)
		return createScalarFieldSimulation()
	},
})
