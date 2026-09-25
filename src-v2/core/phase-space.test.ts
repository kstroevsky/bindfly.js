import assert from 'node:assert/strict'
import test from 'node:test'

import { createPhaseSpaceTransform } from './phase-space.ts'
import { createViewport } from './viewport.ts'

test('phase-space transform is isotropic and invertible on rectangular viewports', () => {
	const viewport = createViewport({ cssWidth: 600, cssHeight: 300, devicePixelRatio: 2 })
	const transform = createPhaseSpaceTransform(viewport, 3)

	assert.equal(transform.pixelsPerUnit, 50)
	assert.deepEqual(transform.visibleBounds, { minX: -6, maxX: 6, minY: -3, maxY: 3 })
	const origin = transform.toCanvas({ x: 0, y: 0 })
	const xUnit = transform.toCanvas({ x: 1, y: 0 })
	const yUnit = transform.toCanvas({ x: 0, y: 1 })
	assert.equal(xUnit.x - origin.x, origin.y - yUnit.y)
	assert.deepEqual(transform.toMathematical(transform.toCanvas({ x: 2.25, y: -1.5 })), { x: 2.25, y: -1.5 })
})

test('phase-space transform rejects invalid domain radius', () => {
	const viewport = createViewport({ cssWidth: 600, cssHeight: 300, devicePixelRatio: 1 })
	assert.throws(() => createPhaseSpaceTransform(viewport, 0), /positive and finite/)
})
