import type { ClockAdvance, RenderFrame, SimulationStep, Viewport } from '@bindfly-v2/core'

import type { FixedStepClock } from './fixed-step-clock.ts'
import { assertRuntimeTransition } from './lifecycle.ts'
import type { RuntimeState } from './lifecycle.ts'

export interface AnimationFrameScheduler {
	request(callback: (timestampMs: number) => void): number
	cancel(id: number): void
}

export interface FixedStepLoopCallbacks<Input, ParameterPatch> {
	step(step: SimulationStep): void
	render(frame: RenderFrame, advance: ClockAdvance): void
	applyInput(input: Input): void
	applyParameterPatch(patch: ParameterPatch): void
	reset(): void
	resize(viewport: Viewport): void
	dispose(): void
	onOverload?(advance: ClockAdvance): void
	onError?(error: unknown): void
}

interface ScheduledEventBase {
	readonly sequence: number
	readonly stepIndex: number
}

export type ScheduledLoopEvent<Input, ParameterPatch> =
	| (ScheduledEventBase & { readonly type: 'input'; readonly input: Input })
	| (ScheduledEventBase & { readonly type: 'parameters'; readonly patch: ParameterPatch })

export interface FixedStepLoopOptions<Input, ParameterPatch> {
	readonly clock: FixedStepClock
	readonly scheduler: AnimationFrameScheduler
	readonly callbacks: FixedStepLoopCallbacks<Input, ParameterPatch>
}

export class FixedStepLoop<Input, ParameterPatch> {
	readonly clock: FixedStepClock
	private readonly scheduler: AnimationFrameScheduler
	private readonly callbacks: FixedStepLoopCallbacks<Input, ParameterPatch>
	private lifecycleState: RuntimeState = 'ready'
	private animationFrameId: number | undefined
	private previousTimestampMs: number | undefined
	private frameIndex = 0
	private sequence = 0
	private queue: ScheduledLoopEvent<Input, ParameterPatch>[] = []
	private appliedEvents: ScheduledLoopEvent<Input, ParameterPatch>[] = []

	constructor({ clock, scheduler, callbacks }: FixedStepLoopOptions<Input, ParameterPatch>) {
		this.clock = clock
		this.scheduler = scheduler
		this.callbacks = callbacks
	}

	get state(): RuntimeState {
		return this.lifecycleState
	}

	get eventLog(): readonly ScheduledLoopEvent<Input, ParameterPatch>[] {
		return [...this.appliedEvents]
	}

	private transition(to: RuntimeState): void {
		assertRuntimeTransition(this.lifecycleState, to)
		this.lifecycleState = to
	}

	private assertOperational(operation: string): void {
		if (!['ready', 'running', 'paused'].includes(this.lifecycleState)) {
			throw new Error(`Cannot ${operation} a fixed-step loop in '${this.lifecycleState}' state.`)
		}
	}

	private requestFrame(): void {
		if (this.animationFrameId !== undefined || this.lifecycleState !== 'running') return
		this.animationFrameId = this.scheduler.request(this.onAnimationFrame)
	}

	private cancelFrame(): void {
		if (this.animationFrameId === undefined) return
		this.scheduler.cancel(this.animationFrameId)
		this.animationFrameId = undefined
	}

	private applyEvents(stepIndex: number): void {
		const remaining: ScheduledLoopEvent<Input, ParameterPatch>[] = []
		for (const event of this.queue) {
			if (event.stepIndex !== stepIndex) {
				remaining.push(event)
				continue
			}
			if (event.type === 'input') this.callbacks.applyInput(event.input)
			else this.callbacks.applyParameterPatch(event.patch)
			this.appliedEvents.push(event)
		}
		this.queue = remaining
	}

	private render(advance: ClockAdvance): void {
		this.callbacks.render({
			frameIndex: this.frameIndex++,
			simulationStepIndex: this.clock.stepIndex,
			interpolationAlpha: advance.interpolationAlpha,
		}, advance)
	}

	private readonly onAnimationFrame = (timestampMs: number): void => {
		this.animationFrameId = undefined
		if (this.lifecycleState !== 'running') return

		try {
			const deltaSeconds = this.previousTimestampMs === undefined
				? 0
				: Math.max(0, (timestampMs - this.previousTimestampMs) / 1000)
			this.previousTimestampMs = timestampMs
			const advance = this.clock.advance(deltaSeconds)

			for (const step of advance.steps) {
				this.applyEvents(step.index)
				this.callbacks.step(step)
			}
			if (advance.saturated) this.callbacks.onOverload?.(advance)

			this.render(advance)
			this.requestFrame()
		} catch (error) {
			this.transition('failed')
			this.callbacks.onError?.(error)
		}
	}

	start(): void {
		this.transition('running')
		this.previousTimestampMs = undefined
		this.requestFrame()
	}

	pause(): void {
		this.transition('paused')
		this.clock.pause()
		this.previousTimestampMs = undefined
		this.cancelFrame()
	}

	resume(): void {
		this.transition('running')
		this.clock.resume()
		this.previousTimestampMs = undefined
		this.requestFrame()
	}

	reset(): void {
		this.assertOperational('reset')
		this.clock.reset()
		this.previousTimestampMs = undefined
		this.frameIndex = 0
		this.sequence = 0
		this.queue = []
		this.appliedEvents = []
		this.callbacks.reset()
		this.render({
			steps: [],
			droppedSeconds: 0,
			droppedStepCount: 0,
			interpolationAlpha: 0,
			saturated: false,
		})
	}

	resize(viewport: Viewport): void {
		this.assertOperational('resize')
		this.callbacks.resize(viewport)
	}

	scheduleInput(input: Input, stepIndex = this.clock.stepIndex): ScheduledLoopEvent<Input, ParameterPatch> {
		return this.schedule({ type: 'input', input }, stepIndex)
	}

	scheduleParameterPatch(
		patch: ParameterPatch,
		stepIndex = this.clock.stepIndex,
	): ScheduledLoopEvent<Input, ParameterPatch> {
		return this.schedule({ type: 'parameters', patch }, stepIndex)
	}

	private schedule(
		payload: { readonly type: 'input'; readonly input: Input }
			| { readonly type: 'parameters'; readonly patch: ParameterPatch },
		stepIndex: number,
	): ScheduledLoopEvent<Input, ParameterPatch> {
		this.assertOperational('schedule work on')
		if (!Number.isInteger(stepIndex) || stepIndex < this.clock.stepIndex) {
			throw new RangeError(`Scheduled step ${stepIndex} is before the next step ${this.clock.stepIndex}.`)
		}
		const event = { ...payload, stepIndex, sequence: this.sequence++ } as ScheduledLoopEvent<Input, ParameterPatch>
		this.queue.push(event)
		this.queue.sort((left, right) => left.stepIndex - right.stepIndex || left.sequence - right.sequence)
		return event
	}

	dispose(): void {
		if (this.lifecycleState === 'disposed') return
		this.transition('disposing')
		this.cancelFrame()
		this.queue = []
		this.callbacks.dispose()
		this.transition('disposed')
	}
}

export const browserAnimationFrameScheduler: AnimationFrameScheduler = {
	request: (callback) => window.requestAnimationFrame(callback),
	cancel: (id) => window.cancelAnimationFrame(id),
}
