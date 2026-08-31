export interface SimulationStep {
	readonly index: number
	readonly dtSeconds: number
	readonly elapsedSeconds: number
}

export interface ClockAdvance {
	readonly steps: readonly SimulationStep[]
	readonly droppedSeconds: number
	readonly droppedStepCount: number
	readonly interpolationAlpha: number
	readonly saturated: boolean
}

export interface SimulationClock {
	readonly paused: boolean
	readonly stepIndex: number
	readonly stepSeconds: number
	readonly simulationSpeed: number
	advance(realDeltaSeconds: number): ClockAdvance
	pause(): void
	resume(): void
	reset(): void
	setSimulationSpeed(speed: number): void
}

export type DeterminismTier = 'same-build-cpu'

export interface ExperimentTiming {
	readonly fixedStepSeconds: number
	readonly deterministicTier: DeterminismTier
	readonly stateTolerance: number
}
