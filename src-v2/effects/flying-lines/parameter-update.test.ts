import assert from 'node:assert/strict'
import test from 'node:test'

import type { FlyingLinesState } from './types.ts'
import { applyFlyingLinesHotParameters } from './parameter-update.ts'

test('hot parameters preserve the live particle world', () => {
	const particles = {
		count: 1, capacity: 1,
		ids: new Uint32Array([7]),
		x: new Float64Array([10]), y: new Float64Array([20]),
		velocityX: new Float64Array([1]), velocityY: new Float64Array([2]), lifeSeconds: new Float64Array([3]),
	}
	const state: FlyingLinesState = { particles, connectionRadius: 250, background: '#000000' }
	applyFlyingLinesHotParameters(state, { connectionRadius: 80, background: '#101018' })
	assert.equal(state.particles, particles)
	assert.deepEqual([...state.particles.x], [10])
	assert.equal(state.connectionRadius, 80)
	assert.equal(state.background, '#101018')
})
