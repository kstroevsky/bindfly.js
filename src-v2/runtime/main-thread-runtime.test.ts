import assert from 'node:assert/strict'
import test from 'node:test'

import { defineParameterSchema } from '../core/index.ts'
import { FixedStepClock } from './fixed-step-clock.ts'
import { FixedStepLoop } from './fixed-step-loop.ts'
import type { AnimationFrameScheduler } from './fixed-step-loop.ts'
import { MainThreadRuntime } from './main-thread-runtime.ts'

const schema = defineParameterSchema({ speed: { kind: 'number', default: 1, invalidation: 'hot-update' } })

test('adapts the fixed-step loop to the execution backend lifecycle', async () => {
	let nextId = 0
	const callbacks = new Map<number, (timestamp: number) => void>()
	const scheduler: AnimationFrameScheduler = {
		request: (callback) => { const id = nextId++; callbacks.set(id, callback); return id },
		cancel: (id) => { callbacks.delete(id) },
	}
	const actions: string[] = []
	const loop = new FixedStepLoop<{ type: 'nudge' }, { speed?: number }>({
		clock: new FixedStepClock({ stepSeconds: 1 / 60, maxCatchUpSteps: 4 }),
		scheduler,
		callbacks: {
			step: () => {}, render: () => {}, reset: () => {}, dispose: () => actions.push('dispose'),
			resize: () => actions.push('resize'), applyInput: () => actions.push('input'),
			applyParameterPatch: () => actions.push('parameters'),
		},
	})
	const runtime = new MainThreadRuntime<typeof schema, { type: 'nudge' }>(loop)

	await runtime.initialize()
	await runtime.start()
	await runtime.resize({ cssWidth: 1, cssHeight: 1, devicePixelRatio: 1, backingWidth: 1, backingHeight: 1 })
	await runtime.applyInput({ type: 'nudge' })
	await runtime.updateParameters({ speed: 2 })
	await runtime.pause()
	await runtime.resume()
	await runtime.reset()
	await runtime.dispose()
	assert.equal(runtime.state, 'disposed')
	assert.deepEqual(actions, ['resize', 'dispose'])
})
