import type { SimulationStep } from './clock.ts'
import type { Viewport } from './viewport.ts'

export interface Simulation<State, Input> {
	readonly state: State
	step(frame: SimulationStep): void
	applyInput(input: Input): void
	resize(viewport: Viewport): void
	reset(): void
	dispose(): void
}
