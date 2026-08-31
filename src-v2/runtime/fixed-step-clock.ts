import type { ClockAdvance, SimulationClock, SimulationStep } from '@bindfly-v2/core'

export interface FixedStepClockOptions {
	readonly stepSeconds: number
	readonly maxCatchUpSteps: number
	readonly simulationSpeed?: number
}

const validatePositiveFinite = (name: string, value: number): void => {
	if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be a positive finite number.`)
}

export class FixedStepClock implements SimulationClock {
	readonly stepSeconds: number
	readonly maxCatchUpSteps: number
	private accumulatorSeconds = 0
	private currentStepIndex = 0
	private isPaused = false
	private speed: number

	constructor({ stepSeconds, maxCatchUpSteps, simulationSpeed = 1 }: FixedStepClockOptions) {
		validatePositiveFinite('stepSeconds', stepSeconds)
		if (!Number.isInteger(maxCatchUpSteps) || maxCatchUpSteps <= 0) {
			throw new RangeError('maxCatchUpSteps must be a positive integer.')
		}
		validatePositiveFinite('simulationSpeed', simulationSpeed)
		this.stepSeconds = stepSeconds
		this.maxCatchUpSteps = maxCatchUpSteps
		this.speed = simulationSpeed
	}

	get paused(): boolean {
		return this.isPaused
	}

	get stepIndex(): number {
		return this.currentStepIndex
	}

	get simulationSpeed(): number {
		return this.speed
	}

	advance(realDeltaSeconds: number): ClockAdvance {
		if (!Number.isFinite(realDeltaSeconds) || realDeltaSeconds < 0) {
			throw new RangeError('realDeltaSeconds must be finite and non-negative.')
		}

		if (this.isPaused) {
			return {
				steps: [],
				droppedSeconds: 0,
				droppedStepCount: 0,
				interpolationAlpha: this.accumulatorSeconds / this.stepSeconds,
				saturated: false,
			}
		}

		this.accumulatorSeconds += realDeltaSeconds * this.speed
		const epsilon = this.stepSeconds * 1e-9
		const availableStepCount = Math.floor((this.accumulatorSeconds + epsilon) / this.stepSeconds)
		const stepCount = Math.min(availableStepCount, this.maxCatchUpSteps)
		const droppedStepCount = Math.max(0, availableStepCount - stepCount)
		const steps: SimulationStep[] = []

		for (let offset = 0; offset < stepCount; offset++) {
			const index = this.currentStepIndex++
			steps.push({
				index,
				dtSeconds: this.stepSeconds,
				elapsedSeconds: (index + 1) * this.stepSeconds,
			})
		}

		this.accumulatorSeconds -= (stepCount + droppedStepCount) * this.stepSeconds
		if (Math.abs(this.accumulatorSeconds) <= epsilon) this.accumulatorSeconds = 0

		return {
			steps,
			droppedSeconds: droppedStepCount * this.stepSeconds,
			droppedStepCount,
			interpolationAlpha: this.accumulatorSeconds / this.stepSeconds,
			saturated: droppedStepCount > 0,
		}
	}

	pause(): void {
		this.isPaused = true
	}

	resume(): void {
		this.isPaused = false
	}

	reset(): void {
		this.accumulatorSeconds = 0
		this.currentStepIndex = 0
	}

	setSimulationSpeed(speed: number): void {
		validatePositiveFinite('simulationSpeed', speed)
		this.speed = speed
	}
}
