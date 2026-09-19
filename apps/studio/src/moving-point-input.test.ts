import assert from 'node:assert/strict'
import test from 'node:test'

import { parseMovingPointInput } from './moving-point-input.ts'

test('point-input parser validates the shared interaction domain', () => {
	assert.deepEqual(parseMovingPointInput({ type: 'move-point', id: 7, x: 12, y: 14 }), {
		type: 'move-point', id: 7, x: 12, y: 14,
	})
	assert.throws(() => parseMovingPointInput({ type: 'unknown' }), /unsupported/)
	assert.throws(() => parseMovingPointInput({ type: 'add-point', x: Number.NaN, y: 1 }), /finite number/)
	assert.throws(() => parseMovingPointInput({ type: 'move-point', id: -1, x: 1, y: 2 }), /non-negative/)
	assert.throws(() => parseMovingPointInput({ type: 'move-point', id: 1.5, x: 1, y: 2 }), /integer/)
})
