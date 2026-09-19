import type { Simulation, SimulationStep, Viewport } from '../../core/index.ts'

import type { ParametricOriginalInput, ParametricOriginalKind, ParametricOriginalParameters, ParametricOriginalState } from './types.ts'

export interface CreateParametricOriginalSimulationInput {
	readonly parameters: ParametricOriginalParameters
	readonly viewport: Viewport
	readonly kind: ParametricOriginalKind
}

const INITIAL_ACCUMULATOR = 2.6
const LEGACY_ACCUMULATOR_DELTA = 0.999995

export const createParametricOriginalSimulation = ({
	parameters,
	viewport: initialViewport,
	kind,
}: CreateParametricOriginalSimulationInput): Simulation<ParametricOriginalState, ParametricOriginalInput> => {
	let viewport = initialViewport
	let disposed = false
	const phases = {
		count: parameters.particleCount,
		capacity: parameters.particleCount,
		values: new Float64Array(parameters.particleCount),
	}
	const state: ParametricOriginalState = {
		phases,
		accumulator: INITIAL_ACCUMULATOR,
		reverse: false,
		centerX: viewport.cssWidth / 2,
		centerY: viewport.cssHeight / 2,
	}
	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed parametric-original simulation.')
	}
	const reset = () => {
		state.accumulator = INITIAL_ACCUMULATOR
		state.reverse = false
		state.centerX = viewport.cssWidth / 2
		state.centerY = viewport.cssHeight / 2
		phases.values.fill(INITIAL_ACCUMULATOR)
	}
	reset()

	return {
		state,
		step: (_step: SimulationStep) => {
			assertActive()
			if (state.accumulator > 2.9) state.reverse = true
			else if (state.accumulator < 2.65) state.reverse = false
			for (let index = 0; index < phases.count; index++) {
				if (kind === 'pulse') {
					state.accumulator += state.reverse ? 1 : -1
					state.accumulator += state.reverse ? -0.000005 : 0.000005
				} else {
					state.accumulator += LEGACY_ACCUMULATOR_DELTA * (state.reverse ? 1 : -1)
				}
				phases.values[index] = state.accumulator
			}
		},
		applyInput: (input) => {
			assertActive()
			if (input.type !== 'set-center') throw new Error('Unknown parametric-original input.')
			if (![input.x, input.y].every(Number.isFinite)) throw new TypeError('Parametric center coordinates must be finite.')
			state.centerX = input.x
			state.centerY = input.y
		},
		resize: (nextViewport) => {
			assertActive()
			viewport = nextViewport
			state.centerX = viewport.cssWidth / 2
			state.centerY = viewport.cssHeight / 2
		},
		reset: () => { assertActive(); reset() },
		dispose: () => { disposed = true; phases.count = 0 },
	}
}
