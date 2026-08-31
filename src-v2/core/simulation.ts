import type { SimulationStep } from './clock.ts'

export interface Simulation<State, Input> {
	readonly state: State
	step(frame: SimulationStep): void
	applyInput(input: Input): void
	reset(): void
	dispose(): void
}
