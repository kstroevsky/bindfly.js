import assert from 'node:assert/strict'
import test from 'node:test'

import { parseFlyingLinesInput } from './flying-lines-input.ts'

test('point-input parser validates the shared interaction domain', () => {
	assert.deepEqual(parseFlyingLinesInput({ type: 'move-point', id: 7, x: 12, y: 14 }), {
		type: 'move-point', id: 7, x: 12, y: 14,
	})
	assert.throws(() => parseFlyingLinesInput({ type: 'unknown' }), /unsupported/)
	assert.throws(() => parseFlyingLinesInput({ type: 'add-point', x: Number.NaN, y: 1 }), /finite number/)
	assert.throws(() => parseFlyingLinesInput({ type: 'move-point', id: -1, x: 1, y: 2 }), /non-negative/)
	assert.throws(() => parseFlyingLinesInput({ type: 'move-point', id: 1.5, x: 1, y: 2 }), /integer/)
})
