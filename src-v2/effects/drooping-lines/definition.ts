import { defineExperiment, normalizeParameters } from '../../core/index.ts'
import type { ExperimentStateCodec } from '../../core/index.ts'
import { snapshotMovingPointState } from '../moving-points/snapshot.ts'

import { compileDroopingFormulaPair } from './formula.ts'
import { droopingLinesParameters } from './parameters.ts'
import { createDroopingLinesSimulation } from './simulation.ts'
import type { DroopingLinesInput, DroopingLinesParameters, DroopingLinesState } from './types.ts'

export interface DroopingLinesDurableState {
	readonly parameters: DroopingLinesParameters
	readonly seed: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const codec: ExperimentStateCodec<DroopingLinesDurableState, string> = {
	currentVersion: 2,
	serialize: (state) => JSON.stringify(state),
	parse: (serialized) => {
		if (typeof serialized !== 'string') return { ok: false, error: 'Drooping Lines state must be a string.' }
		try {
			const value = JSON.parse(serialized) as unknown
			if (typeof value !== 'object' || value === null || Array.isArray(value)) {
				return { ok: false, error: 'Drooping Lines state must decode to an object.' }
			}
			const record = value as Record<string, unknown>
			if (typeof record.seed !== 'string' || record.seed.length === 0) {
				return { ok: false, error: 'Drooping Lines state requires a non-empty seed.' }
			}
			const parameters = normalizeParameters(droopingLinesParameters, record.parameters)
			if (!parameters.ok) {
				return { ok: false, error: `Drooping Lines parameters are invalid: ${parameters.issues[0]?.message ?? 'unknown issue'}` }
			}
			const formulas = compileDroopingFormulaPair(parameters.value)
			if (!formulas.ok) return { ok: false, error: `Drooping Lines formulas are invalid: ${formulas.error}` }
			return { ok: true, value: { seed: record.seed, parameters: parameters.value } }
		} catch {
			return { ok: false, error: 'Drooping Lines state is not valid JSON.' }
		}
	},
	migrate: (serialized, context) => {
		if (context.fromVersion === context.toVersion) return { ok: true, value: serialized }
		if (context.fromVersion !== 1 || context.toVersion !== 2) {
			return { ok: false, error: `No Drooping Lines migration from ${context.fromVersion} to ${context.toVersion}.` }
		}
		if (typeof serialized !== 'string') return { ok: false, error: 'Drooping Lines v1 state must be a string.' }
		try {
			const value = JSON.parse(serialized) as unknown
			if (!isRecord(value) || !isRecord(value.parameters)) {
				return { ok: false, error: 'Drooping Lines v1 state must contain parameters.' }
			}
			const { deformation, ...parameters } = value.parameters
			if (deformation !== 'tan-x' && deformation !== 'atan-y') {
				return { ok: false, error: 'Drooping Lines v1 deformation is invalid.' }
			}
			return {
				ok: true,
				value: JSON.stringify({
					...value,
					parameters: {
						...parameters,
						formulaAX: 'tan(x)',
						formulaAY: 'y',
						formulaBX: 'x',
						formulaBY: 'atan(y)',
						formulaMorph: deformation === 'atan-y' ? 1 : 0,
					},
				}),
			}
		} catch {
			return { ok: false, error: 'Drooping Lines v1 state is not valid JSON.' }
		}
	},
}

const defaults = normalizeParameters(droopingLinesParameters, {})
if (!defaults.ok) throw new Error('Drooping Lines defaults are invalid.')

export const snapshotDroopingLinesState = snapshotMovingPointState

export const droopingLinesDefinition = defineExperiment<
	typeof droopingLinesParameters,
	DroopingLinesState,
	DroopingLinesInput,
	DroopingLinesDurableState,
	string
>({
	id: 'drooping-lines',
	stateVersion: 2,
	timing: { fixedStepSeconds: 1 / 120, deterministicTier: 'same-build-cpu', stateTolerance: 1e-9 },
	parameters: droopingLinesParameters,
	stateCodec: codec,
	capabilities: {
		executionProfiles: [
			{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
			{ rendererId: 'canvas2d', runtimeId: 'worker' },
		],
		snapshotState: snapshotDroopingLinesState,
	},
	presets: [
		{ id: 'simple', name: 'Simple', parameters: defaults.value },
		{ id: 'add-by-click', name: 'Add by click', parameters: { ...defaults.value, formulaMorph: 1 } },
	],
	createSimulation: (environment, parameters) => createDroopingLinesSimulation({ environment, parameters }),
})

export default droopingLinesDefinition
