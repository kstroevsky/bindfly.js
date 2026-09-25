import assert from 'node:assert/strict'
import test from 'node:test'

import { defineParameterSchema } from '../core/index.ts'
import { FixedStepClock } from './fixed-step-clock.ts'
import { FixedStepLoop } from './fixed-step-loop.ts'
import type { AnimationFrameScheduler } from './fixed-step-loop.ts'
import { MainThreadRuntime } from './main-thread-runtime.ts'

const schema = defineParameterSchema({ speed: { kind: 'number', default: 1, invalidation: 'hot-update' } })

test('adapts the fixed-step loop to frozen hot updates and explicit stepping', async () => {
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
			step: ({ index }) => actions.push(`step:${index}`), render: ({ simulationStepIndex }) => actions.push(`render:${simulationStepIndex}`), reset: () => {}, dispose: () => actions.push('dispose'),
			resize: () => actions.push('resize'), applyInput: () => actions.push('input'),
			applyParameterPatch: () => actions.push('parameters'),
			updateFormulaView: (view) => actions.push(`formula-view:${view}`),
			inspectPoint: ({ x, y }) => ({ pointId: 4, x, y }),
			capturePointCloud: ({ source }) => ({ snapshotId: 'fixture', source }),
		},
	})
	const runtime = new MainThreadRuntime<typeof schema, { type: 'nudge' }>(loop)

	await runtime.initialize()
	await runtime.start()
	await runtime.resize({ cssWidth: 1, cssHeight: 1, devicePixelRatio: 1, backingWidth: 1, backingHeight: 1 })
	await runtime.applyInput({ type: 'nudge' })
	await runtime.pause()
	await runtime.updateParameters({ speed: 2 })
	await runtime.updateFormulaView('compare')
	assert.equal(loop.clock.stepIndex, 0)
	await runtime.step()
	assert.equal(loop.clock.stepIndex, 1)
	assert.equal(runtime.state, 'paused')
	assert.deepEqual(await runtime.inspectPoint({ x: 10, y: 20 }), { pointId: 4, x: 10, y: 20 })
	assert.deepEqual(await runtime.capturePointCloud({ source: 'morph' }), { snapshotId: 'fixture', source: 'morph' })
	await runtime.resume()
	await runtime.reset()
	await runtime.dispose()
	assert.equal(runtime.state, 'disposed')
	assert.deepEqual(actions, ['resize', 'parameters', 'render:0', 'formula-view:compare', 'render:0', 'input', 'step:0', 'render:1', 'render:0', 'dispose'])
})
