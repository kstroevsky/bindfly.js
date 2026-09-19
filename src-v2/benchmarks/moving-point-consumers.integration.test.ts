import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom, createViewport, normalizeParameters } from '../core/index.ts'
import { droopingLinesDefinition } from '../effects/drooping-lines/definition.ts'
import { droopingLinesParameters } from '../effects/drooping-lines/parameters.ts'
import { flyingLinesDefinition } from '../effects/flying-lines/definition.ts'
import { flyingLinesParameters } from '../effects/flying-lines/parameters.ts'

const viewport = createViewport({ cssWidth: 640, cssHeight: 360, devicePixelRatio: 1 })
const physical = {
	particleCount: 16,
	maxSpeed: 80,
	connectionRadius: 120,
	particleLifetimeSeconds: 20,
	margin: 20,
	background: '#050508',
}

const activeParticles = (state: { readonly particles: {
	readonly count: number
	readonly ids: Uint32Array
	readonly x: Float64Array
	readonly y: Float64Array
	readonly velocityX: Float64Array
	readonly velocityY: Float64Array
	readonly lifeSeconds: Float64Array
} }) => ({
	count: state.particles.count,
	ids: [...state.particles.ids.subarray(0, state.particles.count)],
	x: [...state.particles.x.subarray(0, state.particles.count)],
	y: [...state.particles.y.subarray(0, state.particles.count)],
	velocityX: [...state.particles.velocityX.subarray(0, state.particles.count)],
	velocityY: [...state.particles.velocityY.subarray(0, state.particles.count)],
	lifeSeconds: [...state.particles.lifeSeconds.subarray(0, state.particles.count)],
})

test('Flying Lines and Drooping Lines have identical physical simulation semantics', () => {
	const flyingParameters = normalizeParameters(flyingLinesParameters, physical)
	const droopingParameters = normalizeParameters(droopingLinesParameters, { ...physical, formulaMorph: 1 })
	assert.equal(flyingParameters.ok, true)
	assert.equal(droopingParameters.ok, true)
	if (!flyingParameters.ok || !droopingParameters.ok) return

	const flying = flyingLinesDefinition.createSimulation({ random: createSeededRandom('shared-motion'), viewport }, flyingParameters.value)
	const drooping = droopingLinesDefinition.createSimulation({ random: createSeededRandom('shared-motion'), viewport }, droopingParameters.value)
	assert.deepEqual(activeParticles(drooping.state), activeParticles(flying.state))

	for (let index = 0; index < 20; index++) {
		const step = { index, dtSeconds: 1 / 120, elapsedSeconds: (index + 1) / 120 }
		flying.step(step)
		drooping.step(step)
	}
	const inputs = [
		{ type: 'add-point' as const, x: 100, y: 120 },
		{ type: 'move-nearest' as const, fromX: 100, fromY: 120, x: 130, y: 140, maxDistance: 5 },
		{ type: 'remove-nearest' as const, x: 130, y: 140, maxDistance: 5 },
	]
	for (const input of inputs) { flying.applyInput(input); drooping.applyInput(input) }
	assert.deepEqual(activeParticles(drooping.state), activeParticles(flying.state))

	const resized = createViewport({ cssWidth: 180, cssHeight: 120, devicePixelRatio: 2 })
	flying.resize(resized)
	drooping.resize(resized)
	assert.deepEqual(activeParticles(drooping.state), activeParticles(flying.state))
	flying.reset()
	drooping.reset()
	assert.deepEqual(activeParticles(drooping.state), activeParticles(flying.state))
})
