export interface PhasePortraitTrajectory {
	readonly id: number
	readonly x: number
	readonly y: number
	readonly status: 'active' | 'escaped' | 'invalid'
	readonly trailX: readonly number[]
	readonly trailY: readonly number[]
	readonly trailEpochs?: readonly number[]
}

export interface VectorFieldSample {
	readonly x: number
	readonly y: number
	readonly dx: number
	readonly dy: number
}

export interface PhasePortraitRenderView {
	readonly background: string
	readonly domainRadius: number
	readonly title: string
	readonly trajectories: readonly PhasePortraitTrajectory[]
	readonly trajectoryStyle?: 'curve' | 'points'
	readonly field?: readonly VectorFieldSample[]
}
