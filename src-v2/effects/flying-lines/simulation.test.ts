import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom, createViewport, normalizeParameters } from '../../core/index.ts'
import { flyingLinesParameters } from './parameters.ts'
import { createFlyingLinesSimulation } from './simulation.ts'

const createSimulation = () => {
	const parameters = normalizeParameters(flyingLinesParameters, {
		particleCount: 12,
		maxSpeed: 60,
		connectionRadius: 120,
		particleLifetimeSeconds: 20,
		margin: 20,
		background: '#050508',
	})
	if (!parameters.ok) throw new Error('test parameters must be valid')

	return createFlyingLinesSimulation({
		environment: {
			random: createSeededRandom('phase-3-fixture'),
			viewport: createViewport({ cssWidth: 1000, cssHeight: 800, devicePixelRatio: 1 }),
		},
		parameters: parameters.value,
	})
}

test('creates deterministic particles with independent velocity axes', () => {
	const first = createSimulation()
	const second = createSimulation()

	assert.deepEqual(first.state, second.state)
	assert.ok(first.state.particles.some(({ velocityX, velocityY }) => velocityX !== velocityY))
})

test('uses delta time rather than display-frame count', () => {
	const oneStep = createSimulation()
	const twoSteps = createSimulation()

	oneStep.step({ index: 0, dtSeconds: 0.01, elapsedSeconds: 0.01 })
	twoSteps.step({ index: 0, dtSeconds: 0.005, elapsedSeconds: 0.005 })
	twoSteps.step({ index: 1, dtSeconds: 0.005, elapsedSeconds: 0.01 })

	for (let index = 0; index < oneStep.state.particles.length; index++) {
		const first = oneStep.state.particles[index]
		const second = twoSteps.state.particles[index]
		assert.ok(first && second)
		assert.ok(Math.abs(first.x - second.x) < 1e-9)
		assert.ok(Math.abs(first.y - second.y) < 1e-9)
	}
})

test('supports add, move and remove point inputs', () => {
	const simulation = createSimulation()
	const initialCount = simulation.state.particles.length

	simulation.applyInput({ type: 'add-point', x: 100, y: 120 })
	assert.equal(simulation.state.particles.length, initialCount + 1)
	const added = simulation.state.particles.at(-1)
	assert.ok(added)

	simulation.applyInput({ type: 'move-point', id: added.id, x: 140, y: 160 })
	assert.equal(added.x, 140)
	assert.equal(added.y, 160)

	simulation.applyInput({ type: 'remove-nearest', x: 140, y: 160, maxDistance: 5 })
	assert.equal(simulation.state.particles.length, initialCount)
})

test('reset reproduces the initial deterministic state', () => {
	const simulation = createSimulation()
	const initial = structuredClone(simulation.state)
	simulation.step({ index: 0, dtSeconds: 0.1, elapsedSeconds: 0.1 })
	simulation.reset()
	assert.deepEqual(simulation.state, initial)
})
