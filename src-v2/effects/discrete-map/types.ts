import type { ParameterValues } from '../../core/index.ts'

import type { discreteMapParameters } from './parameters.ts'

export type DiscreteMapParameters = ParameterValues<typeof discreteMapParameters>

export type DiscreteMapOrbitStatus = 'active' | 'escaped' | 'invalid'

export interface DiscreteMapOrbit {
	id: number
	x: number
	y: number
	status: DiscreteMapOrbitStatus
	trailX: number[]
	trailY: number[]
}

export interface DiscreteMapState {
	iteration: number
	nextOrbitId: number
	orbits: DiscreteMapOrbit[]
}

export type DiscreteMapInput = {
	readonly type: 'add-initial-condition'
	readonly x: number
	readonly y: number
}
