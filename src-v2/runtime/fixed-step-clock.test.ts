import assert from 'node:assert/strict'
import test from 'node:test'

import { FixedStepClock } from './fixed-step-clock.ts'

const advanceForOneSecond = (displayHz: number) => {
	const clock = new FixedStepClock({ stepSeconds: 1 / 120, maxCatchUpSteps: 8 })
	const steps = []
	for (let frame = 0; frame < displayHz; frame++) {
		steps.push(...clock.advance(1 / displayHz).steps)
	}
	return { clock, steps }
}

test('produces the same fixed steps at common display refresh rates', () => {
	for (const displayHz of [30, 60, 120, 144]) {
		const { clock, steps } = advanceForOneSecond(displayHz)
		assert.equal(clock.stepIndex, 120, `${displayHz} Hz`)
		assert.equal(steps.length, 120, `${displayHz} Hz`)
		assert.equal(steps.at(-1)?.elapsedSeconds, 1, `${displayHz} Hz`)
	}
})

test('pause ignores wall time and resume continues without a jump', () => {
	const clock = new FixedStepClock({ stepSeconds: 0.01, maxCatchUpSteps: 4 })
	assert.equal(clock.advance(0.01).steps.length, 1)
	clock.pause()
	assert.equal(clock.advance(30).steps.length, 0)
	clock.resume()
	assert.equal(clock.advance(0.01).steps.length, 1)
	assert.equal(clock.stepIndex, 2)
})

test('caps catch-up work and reports every dropped simulation step', () => {
	const clock = new FixedStepClock({ stepSeconds: 0.01, maxCatchUpSteps: 4 })
	const advance = clock.advance(0.1)

	assert.equal(advance.steps.length, 4)
	assert.equal(advance.droppedStepCount, 6)
	assert.ok(Math.abs(advance.droppedSeconds - 0.06) < 1e-12)
	assert.equal(advance.saturated, true)
	assert.equal(clock.stepIndex, 4)
})

test('supports explicit simulation speed and deterministic reset', () => {
	const clock = new FixedStepClock({ stepSeconds: 0.01, maxCatchUpSteps: 8 })
	clock.setSimulationSpeed(2)
	assert.equal(clock.advance(0.02).steps.length, 4)
	clock.reset()
	assert.equal(clock.stepIndex, 0)
	assert.equal(clock.advance(0.005).steps.length, 1)
})

test('rejects invalid timing configuration and deltas', () => {
	assert.throws(() => new FixedStepClock({ stepSeconds: 0, maxCatchUpSteps: 1 }), /stepSeconds/)
	assert.throws(() => new FixedStepClock({ stepSeconds: 0.01, maxCatchUpSteps: 0 }), /maxCatchUpSteps/)
	const clock = new FixedStepClock({ stepSeconds: 0.01, maxCatchUpSteps: 1 })
	assert.throws(() => clock.advance(-1), /realDeltaSeconds/)
	assert.throws(() => clock.setSimulationSpeed(0), /simulationSpeed/)
})
