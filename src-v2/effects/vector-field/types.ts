import type { ParameterValues } from '../../core/index.ts'

import type { vectorFieldParameters } from './parameters.ts'

export type VectorFieldParameters = ParameterValues<typeof vectorFieldParameters>

export type VectorFieldTrajectoryStatus = 'active' | 'escaped' | 'invalid'

export interface VectorFieldTrajectory {
	id: number
	x: number
	y: number
	status: VectorFieldTrajectoryStatus
	trailX: number[]
	trailY: number[]
	trailEpochs: number[]
}

export interface VectorFieldState {
	time: number
	configurationEpoch: number
	nextTrajectoryId: number
	trajectories: VectorFieldTrajectory[]
}

export type VectorFieldInput = {
	readonly type: 'add-initial-condition'
	readonly x: number
	readonly y: number
}
