import { defineExperiment, normalizeParameters } from '../../core/index.ts'
import type { ExperimentDefinition, ExperimentStateCodec } from '../../core/index.ts'
import { bindflyOriginals } from '../../formula/index.ts'
import type { BindflyOriginalId } from '../../formula/index.ts'

import { compileParametricOriginalFormulaPair } from './formula.ts'
import { createParametricOriginalParameters } from './parameters.ts'
import { createParametricOriginalSimulation } from './simulation.ts'
import type {
	ParametricOriginalInput,
	ParametricOriginalKind,
	ParametricOriginalParameters,
	ParametricOriginalState,
} from './types.ts'

export interface ParametricOriginalDurableState {
	readonly parameters: ParametricOriginalParameters
	readonly seed: string
}

export interface ParametricOriginalSpec {
	readonly id: Extract<BindflyOriginalId, 'pulse-2023' | 'spiral-1' | 'spiral-2' | 'spiral-3'>
	readonly kind: ParametricOriginalKind
	readonly legacyRouteName: 'Pulse' | 'Spiral' | 'Spiral2' | 'Spiral3'
}

export interface ParametricOriginalDefinitionBundle {
	readonly spec: ParametricOriginalSpec
	readonly definition: ExperimentDefinition<
		ReturnType<typeof createParametricOriginalParameters>,
		ParametricOriginalState,
		ParametricOriginalInput,
		ParametricOriginalDurableState,
		string,
		ParametricOriginalState
	>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

export const snapshotParametricOriginalState = (state: Readonly<ParametricOriginalState>): ParametricOriginalState => ({
	phases: {
		count: state.phases.count,
		capacity: state.phases.count,
		values: state.phases.values.slice(0, state.phases.count),
	},
	accumulator: state.accumulator,
	reverse: state.reverse,
	centerX: state.centerX,
	centerY: state.centerY,
})

export const createParametricOriginalDefinition = (
	spec: ParametricOriginalSpec,
): ParametricOriginalDefinitionBundle => {
	const original = bindflyOriginals[spec.id]
	const parameters = createParametricOriginalParameters(original)
	const codec: ExperimentStateCodec<ParametricOriginalDurableState, string> = {
		currentVersion: 1,
		serialize: (state) => JSON.stringify(state),
		parse: (serialized) => {
			if (typeof serialized !== 'string') return { ok: false, error: `${original.title} state must be a string.` }
			try {
				const value = JSON.parse(serialized) as unknown
				if (!isRecord(value) || typeof value.seed !== 'string' || value.seed.length === 0) {
					return { ok: false, error: `${original.title} state requires an object and non-empty seed.` }
				}
				const normalized = normalizeParameters(parameters, value.parameters)
				if (!normalized.ok) {
					return { ok: false, error: `${original.title} parameters are invalid: ${normalized.issues[0]?.message ?? 'unknown issue'}` }
				}
				const formulas = compileParametricOriginalFormulaPair(normalized.value)
				if (!formulas.ok) return { ok: false, error: `${original.title} formulas are invalid: ${formulas.error}` }
				return { ok: true, value: { seed: value.seed, parameters: normalized.value } }
			} catch {
				return { ok: false, error: `${original.title} state is not valid JSON.` }
			}
		},
		migrate: (serialized, context) => context.fromVersion === context.toVersion
			? { ok: true, value: serialized }
			: { ok: false, error: `No ${original.title} migration from ${context.fromVersion} to ${context.toVersion}.` },
	}
	const defaults = normalizeParameters(parameters, {})
	if (!defaults.ok) throw new Error(`${original.title} defaults are invalid.`)
	const definition = defineExperiment({
		id: spec.id,
		stateVersion: 1,
		timing: { fixedStepSeconds: 1 / 120, deterministicTier: 'same-build-cpu', stateTolerance: 1e-9 },
		parameters,
		stateCodec: codec,
		capabilities: {
			executionProfiles: [
				{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
				{ rendererId: 'canvas2d', runtimeId: 'worker' },
			],
			snapshotState: snapshotParametricOriginalState,
		},
		presets: [{ id: 'original', name: original.title, parameters: defaults.value }],
		createSimulation: (environment, values) => createParametricOriginalSimulation({
			kind: spec.kind,
			parameters: values,
			viewport: environment.viewport,
		}),
	})
	return { spec, definition }
}

export const parametricOriginalDefinitions = Object.freeze([
	createParametricOriginalDefinition({ id: 'pulse-2023', kind: 'pulse', legacyRouteName: 'Pulse' }),
	createParametricOriginalDefinition({ id: 'spiral-1', kind: 'spiral', legacyRouteName: 'Spiral' }),
	createParametricOriginalDefinition({ id: 'spiral-2', kind: 'spiral', legacyRouteName: 'Spiral2' }),
	createParametricOriginalDefinition({ id: 'spiral-3', kind: 'spiral', legacyRouteName: 'Spiral3' }),
])
