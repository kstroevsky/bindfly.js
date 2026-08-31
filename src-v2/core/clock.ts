export interface SimulationStep {
	readonly index: number
	readonly dtSeconds: number
	readonly elapsedSeconds: number
}

export interface ClockAdvance {
	readonly steps: readonly SimulationStep[]
	readonly droppedSeconds: number
}

export interface SimulationClock {
	readonly paused: boolean
	readonly stepIndex: number
	advance(realDeltaSeconds: number): ClockAdvance
	pause(): void
	resume(): void
	reset(): void
}
