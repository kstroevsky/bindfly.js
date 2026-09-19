import type { Simulation, SimulationEnvironment } from '../../core/index.ts'
import { createMovingPointSimulation } from '../moving-points/simulation.ts'

import type { DroopingLinesInput, DroopingLinesParameters, DroopingLinesState } from './types.ts'

export interface CreateDroopingLinesSimulationInput {
	readonly environment: SimulationEnvironment
	readonly parameters: DroopingLinesParameters
}

export const createDroopingLinesSimulation = ({
	environment,
	parameters,
}: CreateDroopingLinesSimulationInput): Simulation<DroopingLinesState, DroopingLinesInput> =>
	createMovingPointSimulation({ environment, parameters })
