import type { SimulationEnvironment } from '../../core/index.ts'
import { createMovingPointSimulation } from '../moving-points/simulation.ts'
import type { CheckpointableMovingPointSimulation } from '../moving-points/simulation.ts'

import type { FlyingLinesParameters } from './types.ts'

export interface CreateFlyingLinesSimulationInput {
	readonly environment: SimulationEnvironment
	readonly parameters: FlyingLinesParameters
}

export const createFlyingLinesSimulation = ({
	environment,
	parameters,
}: CreateFlyingLinesSimulationInput): CheckpointableMovingPointSimulation =>
	createMovingPointSimulation({ environment, parameters })
