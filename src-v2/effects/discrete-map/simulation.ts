import { createPhaseSpaceTransform } from '../../core/index.ts'
import type { Result, Simulation, SimulationStep, Viewport } from '../../core/index.ts'
import type { FormulaIssue } from '../../formula/index.ts'

import type {
	DiscreteMapInput,
	DiscreteMapOrbit,
	DiscreteMapParameters,
	DiscreteMapState,
} from './types.ts'

export const MAXIMUM_DISCRETE_MAP_ORBITS = 24

export type DiscreteMapEvaluator = (
	x: number,
	y: number,
	n: number,
) => Result<{ readonly x: number; readonly y: number }, FormulaIssue>

const createOrbit = (id: number, x: number, y: number): DiscreteMapOrbit => ({
	id,
	x,
	y,
	status: 'active',
	trailX: [x],
	trailY: [y],
})

const appendTrail = (orbit: DiscreteMapOrbit, trailLength: number) => {
	orbit.trailX.push(orbit.x)
	orbit.trailY.push(orbit.y)
	if (orbit.trailX.length > trailLength) {
		orbit.trailX.shift()
		orbit.trailY.shift()
	}
}

export const snapshotDiscreteMapState = (state: Readonly<DiscreteMapState>): DiscreteMapState => ({
	iteration: state.iteration,
	nextOrbitId: state.nextOrbitId,
	orbits: state.orbits.map((orbit) => ({
		...orbit,
		trailX: [...orbit.trailX],
		trailY: [...orbit.trailY],
	})),
})

export const createDiscreteMapSimulation = (input: {
	readonly parameters: DiscreteMapParameters
	readonly evaluate: DiscreteMapEvaluator
	readonly viewport: Viewport
}): Simulation<DiscreteMapState, DiscreteMapInput> => {
	const { parameters, evaluate } = input
	let viewport = input.viewport
	let disposed = false
	const state: DiscreteMapState = { iteration: 0, nextOrbitId: 1, orbits: [] }
	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed discrete-map simulation.')
	}
	const reset = () => {
		state.iteration = 0
		state.nextOrbitId = 1
		state.orbits = [createOrbit(0, 0, 0)]
	}
	reset()

	return {
		state,
		step: (_step: SimulationStep) => {
			assertActive()
			const iteration = state.iteration
			for (const orbit of state.orbits) {
				if (orbit.status !== 'active') continue
				const next = evaluate(orbit.x, orbit.y, iteration)
				if (!next.ok) {
					orbit.status = 'invalid'
					continue
				}
				orbit.x = next.value.x
				orbit.y = next.value.y
				if (!Number.isFinite(orbit.x) || !Number.isFinite(orbit.y)) {
					orbit.status = 'invalid'
					continue
				}
				if (Math.abs(orbit.x) > parameters.domainRadius * 16 || Math.abs(orbit.y) > parameters.domainRadius * 16) {
					orbit.status = 'escaped'
					continue
				}
				appendTrail(orbit, parameters.trailLength)
			}
			state.iteration++
		},
		applyInput: (event) => {
			assertActive()
			if (event.type !== 'add-initial-condition') throw new Error('Unknown discrete-map input.')
			if (![event.x, event.y].every(Number.isFinite)) throw new TypeError('Map initial-condition coordinates must be finite.')
			if (state.orbits.length >= MAXIMUM_DISCRETE_MAP_ORBITS) return
			const { x, y } = createPhaseSpaceTransform(viewport, parameters.domainRadius).toMathematical(event)
			state.orbits.push(createOrbit(state.nextOrbitId++, x, y))
		},
		resize: (nextViewport) => { assertActive(); viewport = nextViewport },
		reset: () => { assertActive(); reset() },
		dispose: () => { disposed = true; state.orbits = [] },
	}
}
