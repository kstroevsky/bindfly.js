import type { Simulation, SimulationEnvironment, SimulationStep, Viewport } from '../../core/index.ts'
import { createFlyingLinesSimulation } from '../flying-lines/simulation.ts'
import type { FlyingLinesState } from '../flying-lines/types.ts'

import type { DroopingLinesInput, DroopingLinesParameters, DroopingLinesState } from './types.ts'

export interface CreateDroopingLinesSimulationInput {
	readonly environment: SimulationEnvironment
	readonly parameters: DroopingLinesParameters
}

class DroopingLinesSimulation implements Simulation<DroopingLinesState, DroopingLinesInput> {
	readonly state: DroopingLinesState
	private readonly movement: Simulation<FlyingLinesState, DroopingLinesInput>

	constructor(environment: SimulationEnvironment, parameters: DroopingLinesParameters) {
		this.movement = createFlyingLinesSimulation({
			environment,
			parameters: {
				particleCount: parameters.particleCount,
				maxSpeed: parameters.maxSpeed,
				connectionRadius: parameters.connectionRadius,
				particleLifetimeSeconds: parameters.particleLifetimeSeconds,
				margin: parameters.margin,
				background: parameters.background,
			},
		})
		this.state = { particles: this.movement.state.particles }
	}

	step(frame: SimulationStep): void { this.movement.step(frame) }
	applyInput(input: DroopingLinesInput): void { this.movement.applyInput(input) }
	resize(viewport: Viewport): void { this.movement.resize(viewport) }
	reset(): void { this.movement.reset() }
	dispose(): void { this.movement.dispose() }
}

export const createDroopingLinesSimulation = ({
	environment,
	parameters,
}: CreateDroopingLinesSimulationInput): Simulation<DroopingLinesState, DroopingLinesInput> =>
	new DroopingLinesSimulation(environment, parameters)
