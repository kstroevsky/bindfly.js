import assert from 'node:assert/strict'
import test from 'node:test'

import { createDroopingGeometry } from './geometry.ts'

const particles = {
	count: 2,
	capacity: 2,
	ids: new Uint32Array([0, 1]),
	x: new Float64Array([0, 1]),
	y: new Float64Array([0, 1]),
	velocityX: new Float64Array(2),
	velocityY: new Float64Array(2),
	lifeSeconds: new Float64Array(2),
}

test('derives the two legacy Drooping Lines coordinate transformations', () => {
	const geometry = createDroopingGeometry(2)
	const tangent = geometry.update({ particles, connectionRadius: 10, deformation: 'tan-x' })
	assert.equal(tangent.count, 4)
	assert.equal(tangent.sourceX[2], Math.tan(1))
	assert.equal(tangent.sourceY[2], 1)

	const arctangent = geometry.update({ particles, connectionRadius: 10, deformation: 'atan-y' })
	assert.equal(arctangent.count, 4)
	assert.equal(arctangent.sourceX[2], 1)
	assert.equal(arctangent.sourceY[2], Math.atan(1))
	assert.equal(arctangent.targetX[2], 0)
	assert.equal(arctangent.targetY[2], 0)
})
