import assert from 'node:assert/strict'
import test from 'node:test'

import { createAdaptiveProximityDerivation } from './adaptive-proximity-derivation.ts'

const points = (count: number, spacing: number) => ({
	count,
	capacity: count,
	ids: Uint32Array.from({ length: count }, (_, index) => index),
	x: Float64Array.from({ length: count }, (_, index) => index * spacing),
	y: new Float64Array(count),
})

test('adaptive derivation owns backend selection behind one synchronous contract', () => {
	const derivation = createAdaptiveProximityDerivation(100)
	const denseResult = derivation.update({ points: points(64, 1), connectionRadius: 100 })
	assert.equal(derivation.backend, 'brute')
	assert.equal(denseResult.edgeCount, 2016)

	const sparseResult = derivation.update({ points: points(64, 100), connectionRadius: 10 })
	assert.equal(derivation.backend, 'grid')
	assert.equal(sparseResult.edgeCount, 0)
	assert.equal(derivation.result, sparseResult)
	derivation.dispose()
	assert.throws(() => derivation.update({ points: points(1, 1), connectionRadius: 1 }), /disposed/)
})
