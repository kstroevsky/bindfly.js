import assert from 'node:assert/strict'
import test from 'node:test'

import { createStage15FrameTimer } from './experiment-session.ts'

test('Stage 15 frame timing keeps simulation, derivation, upload and rendering separate', () => {
	let time = 0
	const timer = createStage15FrameTimer(() => time)
	timer.measureSimulation(() => { time += 2 })
	timer.measureSimulation(() => { time += 3 })
	const derived = timer.measure(() => { time += 5; return 'derived' })
	const rendered = timer.measure(() => { time += 7 })
	assert.equal(derived.value, 'derived')
	assert.deepEqual(timer.finish(derived.durationMs, rendered.durationMs, 11), {
		simulationMs: 5,
		derivationMs: 5,
		uploadMs: 11,
		renderMs: 7,
		totalFrameMs: 28,
	})
	assert.deepEqual(timer.finish(0, 0), {
		simulationMs: 0,
		derivationMs: 0,
		uploadMs: 0,
		renderMs: 0,
		totalFrameMs: 0,
	})
})
