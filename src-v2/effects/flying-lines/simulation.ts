import type { Simulation, SimulationEnvironment } from '../../core/index.ts'
import { createMovingPointSimulation } from '../moving-points/simulation.ts'

import type { FlyingLinesInput, FlyingLinesParameters, FlyingLinesState } from './types.ts'

export interface CreateFlyingLinesSimulationInput {
	readonly environment: SimulationEnvironment
	readonly parameters: FlyingLinesParameters
}

export const createFlyingLinesSimulation = ({
	environment,
	parameters,
}: CreateFlyingLinesSimulationInput): Simulation<FlyingLinesState, FlyingLinesInput> =>
	createMovingPointSimulation({ environment, parameters })
