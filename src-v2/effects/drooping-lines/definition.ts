import { defineExperiment, normalizeParameters } from '../../core/index.ts'
import type { ExperimentStateCodec } from '../../core/index.ts'

import { droopingLinesParameters } from './parameters.ts'
import { createDroopingLinesSimulation } from './simulation.ts'
import type { DroopingLinesInput, DroopingLinesParameters, DroopingLinesState } from './types.ts'

export interface DroopingLinesDurableState {
	readonly parameters: DroopingLinesParameters
	readonly seed: string
}

const codec: ExperimentStateCodec<DroopingLinesDurableState, string> = {
	currentVersion: 1,
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
			return { ok: true, value: { seed: record.seed, parameters: parameters.value } }
		} catch {
			return { ok: false, error: 'Drooping Lines state is not valid JSON.' }
		}
	},
	migrate: (serialized, context) => context.fromVersion === context.toVersion
		? { ok: true, value: serialized }
		: { ok: false, error: `No Drooping Lines migration from ${context.fromVersion} to ${context.toVersion}.` },
}

const defaults = normalizeParameters(droopingLinesParameters, {})
if (!defaults.ok) throw new Error('Drooping Lines defaults are invalid.')

export const snapshotDroopingLinesState = (state: Readonly<DroopingLinesState>): DroopingLinesState => ({
	particles: {
		count: state.particles.count,
		capacity: state.particles.count,
		ids: state.particles.ids.slice(0, state.particles.count),
		x: state.particles.x.slice(0, state.particles.count),
		y: state.particles.y.slice(0, state.particles.count),
		velocityX: state.particles.velocityX.slice(0, state.particles.count),
		velocityY: state.particles.velocityY.slice(0, state.particles.count),
		lifeSeconds: state.particles.lifeSeconds.slice(0, state.particles.count),
	},
})

export const droopingLinesDefinition = defineExperiment<
	typeof droopingLinesParameters,
	DroopingLinesState,
	DroopingLinesInput,
	DroopingLinesDurableState,
	string
>({
	id: 'drooping-lines',
	stateVersion: 1,
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
		{ id: 'add-by-click', name: 'Add by click', parameters: { ...defaults.value, deformation: 'atan-y' } },
	],
	createSimulation: (environment, parameters) => createDroopingLinesSimulation({ environment, parameters }),
})

export default droopingLinesDefinition
