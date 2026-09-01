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
	const particles = first.state.particles
	assert.ok(particles.velocityX.subarray(0, particles.count).some((velocityX, index) => velocityX !== particles.velocityY[index]))
})

test('uses delta time rather than display-frame count', () => {
	const oneStep = createSimulation()
	const twoSteps = createSimulation()

	oneStep.step({ index: 0, dtSeconds: 0.01, elapsedSeconds: 0.01 })
	twoSteps.step({ index: 0, dtSeconds: 0.005, elapsedSeconds: 0.005 })
	twoSteps.step({ index: 1, dtSeconds: 0.005, elapsedSeconds: 0.01 })

	for (let index = 0; index < oneStep.state.particles.count; index++) {
		assert.ok(Math.abs((oneStep.state.particles.x[index] ?? 0) - (twoSteps.state.particles.x[index] ?? 0)) < 1e-9)
		assert.ok(Math.abs((oneStep.state.particles.y[index] ?? 0) - (twoSteps.state.particles.y[index] ?? 0)) < 1e-9)
	}
})

test('supports add, move and remove point inputs', () => {
	const simulation = createSimulation()
	const particles = simulation.state.particles
	const initialCount = particles.count

	simulation.applyInput({ type: 'add-point', x: 100, y: 120 })
	assert.equal(particles.count, initialCount + 1)
	const addedId = particles.ids[initialCount]
	assert.notEqual(addedId, undefined)

	simulation.applyInput({ type: 'move-point', id: addedId ?? 0, x: 140, y: 160 })
	assert.equal(particles.x[initialCount], 140)
	assert.equal(particles.y[initialCount], 160)

	simulation.applyInput({ type: 'remove-nearest', x: 140, y: 160, maxDistance: 5 })
	assert.equal(particles.count, initialCount)
})

test('reset reproduces the initial deterministic state', () => {
	const simulation = createSimulation()
	const initial = structuredClone(simulation.state)
	simulation.step({ index: 0, dtSeconds: 0.1, elapsedSeconds: 0.1 })
	simulation.reset()
	assert.deepEqual(simulation.state, initial)
})

test('resize preserves particles and clamps them into the new viewport', () => {
	const simulation = createSimulation()
	const particles = simulation.state.particles
	const ids = [...particles.ids.subarray(0, particles.count)]
	simulation.resize(createViewport({ cssWidth: 100, cssHeight: 80, devicePixelRatio: 2 }))

	assert.deepEqual([...particles.ids.subarray(0, particles.count)], ids)
	assert.ok(particles.x.subarray(0, particles.count).every((x) => x >= 20 && x <= 80))
	assert.ok(particles.y.subarray(0, particles.count).every((y) => y >= 20 && y <= 60))
})

test('reuses typed storage during steady-state steps', () => {
	const simulation = createSimulation()
	const particles = simulation.state.particles
	const arrays = [particles.ids, particles.x, particles.y, particles.velocityX, particles.velocityY, particles.lifeSeconds]
	for (let index = 0; index < 1_000; index++) {
		simulation.step({ index, dtSeconds: 1 / 120, elapsedSeconds: (index + 1) / 120 })
	}
	assert.deepEqual(
		[particles.ids, particles.x, particles.y, particles.velocityX, particles.velocityY, particles.lifeSeconds],
		arrays,
	)
})

test('grows geometrically and preserves stable IDs and iteration order on removal', () => {
	const simulation = createSimulation()
	const particles = simulation.state.particles
	assert.equal(particles.capacity, 16)
	for (let index = 0; index < 5; index++) simulation.applyInput({ type: 'add-point', x: 100 + index, y: 120 })
	assert.equal(particles.capacity, 32)
	assert.deepEqual([...particles.ids.subarray(0, particles.count)], Array.from({ length: 17 }, (_, index) => index))
	simulation.applyInput({ type: 'remove-nearest', x: 102, y: 120, maxDistance: 0.1 })
	assert.deepEqual(
		[...particles.ids.subarray(12, particles.count)],
		[12, 13, 15, 16],
	)
})
