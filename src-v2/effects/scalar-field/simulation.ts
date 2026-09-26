import type { Simulation, SimulationStep, Viewport } from '../../core/index.ts'

import type { ScalarFieldInput, ScalarFieldState } from './types.ts'

export const snapshotScalarFieldState = (_state: Readonly<ScalarFieldState>): ScalarFieldState => ({ staticField: true })

export const createScalarFieldSimulation = (): Simulation<ScalarFieldState, ScalarFieldInput> => {
	let disposed = false
	const state: ScalarFieldState = { staticField: true }
	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed scalar-field simulation.')
	}

	return {
		state,
		step: (_step: SimulationStep) => { assertActive() },
		applyInput: (_input: ScalarFieldInput) => { assertActive(); throw new Error('Scalar fields do not accept simulation input.') },
		resize: (_viewport: Viewport) => { assertActive() },
		reset: () => { assertActive() },
		dispose: () => { disposed = true },
	}
}
