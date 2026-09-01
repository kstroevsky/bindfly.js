import assert from 'node:assert/strict'
import test from 'node:test'

import { createViewport } from '../core/index.ts'
import { FixedStepClock } from './fixed-step-clock.ts'
import { FixedStepLoop } from './fixed-step-loop.ts'
import type { AnimationFrameScheduler } from './fixed-step-loop.ts'

class ManualAnimationFrameScheduler implements AnimationFrameScheduler {
	private nextId = 1
	readonly pending = new Map<number, (timestampMs: number) => void>()
	readonly cancelled: number[] = []

	request(callback: (timestampMs: number) => void): number {
		const id = this.nextId++
		this.pending.set(id, callback)
		return id
	}

	cancel(id: number): void {
		this.cancelled.push(id)
		this.pending.delete(id)
	}

	fire(timestampMs: number): number {
		const entry = [...this.pending.entries()].sort(([left], [right]) => left - right)[0]
		if (!entry) throw new Error('No animation frame is pending.')
		const [id, callback] = entry
		this.pending.delete(id)
		callback(timestampMs)
		return id
	}
}

test('applies scheduled events at exact steps and owns frame lifecycle', () => {
	const scheduler = new ManualAnimationFrameScheduler()
	const actions: string[] = []
	let disposeCount = 0
	const loop = new FixedStepLoop<string, { readonly speed: number }>({
		clock: new FixedStepClock({ stepSeconds: 1 / 120, maxCatchUpSteps: 8 }),
		scheduler,
		callbacks: {
			step: ({ index }) => actions.push(`step:${index}`),
			render: ({ simulationStepIndex }) => actions.push(`render:${simulationStepIndex}`),
			applyInput: (input) => actions.push(`input:${input}`),
			applyParameterPatch: ({ speed }) => actions.push(`speed:${speed}`),
			reset: () => actions.push('reset'),
			resize: ({ cssWidth }) => actions.push(`resize:${cssWidth}`),
			dispose: () => { disposeCount++ },
		},
	})

	const inputEvent = loop.scheduleInput('add', 0)
	const parameterEvent = loop.scheduleParameterPatch({ speed: 2 }, 1)
	loop.start()
	scheduler.fire(0)
	scheduler.fire(1000 / 60)

	assert.deepEqual(actions, [
		'render:0',
		'input:add',
		'step:0',
		'speed:2',
		'step:1',
		'render:2',
	])
	assert.deepEqual(loop.eventLog, [inputEvent, parameterEvent])
	assert.throws(() => loop.scheduleInput('late', 1), /before the next step 2/)

	const pendingBeforePause = [...scheduler.pending.keys()][0]
	assert.ok(pendingBeforePause)
	loop.pause()
	assert.deepEqual(scheduler.cancelled, [pendingBeforePause])
	assert.equal(loop.state, 'paused')
	loop.resume()
	scheduler.fire(60_000)
	assert.equal(loop.clock.stepIndex, 2, 'resume rebases wall time')

	loop.resize(createViewport({ cssWidth: 640, cssHeight: 480, devicePixelRatio: 1 }))
	loop.reset()
	assert.equal(loop.clock.stepIndex, 0)
	assert.deepEqual(loop.eventLog, [])
	assert.deepEqual(actions.slice(-3), ['resize:640', 'reset', 'render:0'])

	const pendingBeforeDispose = [...scheduler.pending.keys()][0]
	assert.ok(pendingBeforeDispose)
	loop.dispose()
	loop.dispose()
	assert.equal(loop.state, 'disposed')
	assert.equal(disposeCount, 1)
	assert.equal(scheduler.cancelled.at(-1), pendingBeforeDispose)
})

test('surfaces clock saturation through loop telemetry', () => {
	const scheduler = new ManualAnimationFrameScheduler()
	const droppedSteps: number[] = []
	const loop = new FixedStepLoop<never, never>({
		clock: new FixedStepClock({ stepSeconds: 0.01, maxCatchUpSteps: 2 }),
		scheduler,
		callbacks: {
			step: () => {},
			render: () => {},
			applyInput: () => {},
			applyParameterPatch: () => {},
			reset: () => {},
			resize: () => {},
			dispose: () => {},
			onOverload: ({ droppedStepCount }) => droppedSteps.push(droppedStepCount),
		},
	})

	loop.start()
	scheduler.fire(0)
	scheduler.fire(100)
	assert.deepEqual(droppedSteps, [8])
	loop.dispose()
})

test('enters failed state and stops scheduling when a callback throws', () => {
	const scheduler = new ManualAnimationFrameScheduler()
	const errors: unknown[] = []
	const loop = new FixedStepLoop<never, never>({
		clock: new FixedStepClock({ stepSeconds: 0.01, maxCatchUpSteps: 2 }),
		scheduler,
		callbacks: {
			step: () => { throw new Error('simulation failed') },
			render: () => {},
			applyInput: () => {},
			applyParameterPatch: () => {},
			reset: () => {},
			resize: () => {},
			dispose: () => {},
			onError: (error) => errors.push(error),
		},
	})

	loop.start()
	scheduler.fire(0)
	scheduler.fire(10)
	assert.equal(loop.state, 'failed')
	assert.equal(scheduler.pending.size, 0)
	assert.match(String(errors[0]), /simulation failed/)
	assert.throws(() => loop.reset(), /in 'failed' state/)
	loop.dispose()
})
