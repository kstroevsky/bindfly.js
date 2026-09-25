import type { Result, Simulation, SimulationStep, Viewport } from '../../core/index.ts'
import type { FormulaIssue } from '../../formula/index.ts'
import type {
	VectorFieldInput,
	VectorFieldParameters,
	VectorFieldState,
	VectorFieldTrajectory,
} from './types.ts'

export const MAXIMUM_VECTOR_FIELD_TRAJECTORIES = 24

export type VectorFieldEvaluator = (
	x: number,
	y: number,
	t: number,
) => Result<{ readonly dx: number; readonly dy: number }, FormulaIssue>

const appendTrail = (trajectory: VectorFieldTrajectory, trailLength: number) => {
	trajectory.trailX.push(trajectory.x)
	trajectory.trailY.push(trajectory.y)
	if (trajectory.trailX.length > trailLength) {
		trajectory.trailX.shift()
		trajectory.trailY.shift()
	}
}

const createTrajectory = (id: number, x: number, y: number): VectorFieldTrajectory => ({
	id,
	x,
	y,
	status: 'active',
	trailX: [x],
	trailY: [y],
})

export const snapshotVectorFieldState = (state: Readonly<VectorFieldState>): VectorFieldState => ({
	time: state.time,
	nextTrajectoryId: state.nextTrajectoryId,
	trajectories: state.trajectories.map((trajectory) => ({
		...trajectory,
		trailX: [...trajectory.trailX],
		trailY: [...trajectory.trailY],
	})),
})

export const createVectorFieldSimulation = (input: {
	readonly parameters: VectorFieldParameters
	readonly evaluate: VectorFieldEvaluator
	readonly viewport: Viewport
}): Simulation<VectorFieldState, VectorFieldInput> => {
	const { parameters, evaluate } = input
	let viewport = input.viewport
	let disposed = false
	const state: VectorFieldState = { time: 0, nextTrajectoryId: 1, trajectories: [] }
	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed vector-field simulation.')
	}
	const reset = () => {
		state.time = 0
		state.nextTrajectoryId = 1
		state.trajectories = [createTrajectory(0, 1.5, 0)]
	}
	reset()

	return {
		state,
		step: (step: SimulationStep) => {
			assertActive()
			const dt = step.dtSeconds
			for (const trajectory of state.trajectories) {
				if (trajectory.status !== 'active') continue
				const k1 = evaluate(trajectory.x, trajectory.y, state.time)
				if (!k1.ok) { trajectory.status = 'invalid'; continue }
				const k2 = evaluate(
					trajectory.x + k1.value.dx * dt / 2,
					trajectory.y + k1.value.dy * dt / 2,
					state.time + dt / 2,
				)
				if (!k2.ok) { trajectory.status = 'invalid'; continue }
				const k3 = evaluate(
					trajectory.x + k2.value.dx * dt / 2,
					trajectory.y + k2.value.dy * dt / 2,
					state.time + dt / 2,
				)
				if (!k3.ok) { trajectory.status = 'invalid'; continue }
				const k4 = evaluate(
					trajectory.x + k3.value.dx * dt,
					trajectory.y + k3.value.dy * dt,
					state.time + dt,
				)
				if (!k4.ok) { trajectory.status = 'invalid'; continue }
				trajectory.x += dt * (k1.value.dx + 2 * k2.value.dx + 2 * k3.value.dx + k4.value.dx) / 6
				trajectory.y += dt * (k1.value.dy + 2 * k2.value.dy + 2 * k3.value.dy + k4.value.dy) / 6
				if (!Number.isFinite(trajectory.x) || !Number.isFinite(trajectory.y)) {
					trajectory.status = 'invalid'
					continue
				}
				if (Math.abs(trajectory.x) > parameters.domainRadius * 8 || Math.abs(trajectory.y) > parameters.domainRadius * 8) {
					trajectory.status = 'escaped'
					continue
				}
				appendTrail(trajectory, parameters.trailLength)
			}
			state.time += dt
		},
		applyInput: (event) => {
			assertActive()
			if (event.type !== 'add-initial-condition') throw new Error('Unknown vector-field input.')
			if (![event.x, event.y].every(Number.isFinite)) throw new TypeError('Initial-condition coordinates must be finite.')
			if (state.trajectories.length >= MAXIMUM_VECTOR_FIELD_TRAJECTORIES) return
			const x = (event.x / viewport.cssWidth * 2 - 1) * parameters.domainRadius
			const y = (1 - event.y / viewport.cssHeight * 2) * parameters.domainRadius
			state.trajectories.push(createTrajectory(state.nextTrajectoryId++, x, y))
		},
		resize: (nextViewport) => { assertActive(); viewport = nextViewport },
		reset: () => { assertActive(); reset() },
		dispose: () => { disposed = true; state.trajectories = [] },
	}
}
