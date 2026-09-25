import assert from 'node:assert/strict'
import test from 'node:test'

import { encodeMovingPointInputV1, parseMovingPointInput } from './input.ts'

test('point-input parser validates the shared interaction domain', () => {
	assert.deepEqual(parseMovingPointInput({ type: 'move-point', id: 7, x: 12, y: 14 }), {
		type: 'move-point', id: 7, x: 12, y: 14,
	})
	assert.throws(() => parseMovingPointInput({ type: 'unknown' }), /unsupported/)
	assert.throws(() => parseMovingPointInput({ type: 'add-point', x: Number.NaN, y: 1 }), /finite number/)
	assert.throws(() => parseMovingPointInput({ type: 'move-point', id: -1, x: 1, y: 2 }), /non-negative/)
	assert.throws(() => parseMovingPointInput({ type: 'move-point', id: 1.5, x: 1, y: 2 }), /unsigned 32-bit integer/)
})

test('point inputs have deterministic versioned binary identity for collaboration idempotency', () => {
	assert.deepEqual(
		encodeMovingPointInputV1({ type: 'move-point', id: 7, x: 12, y: 14 }),
		encodeMovingPointInputV1(parseMovingPointInput({ y: 14, x: 12, id: 7, type: 'move-point' })),
	)
	assert.notDeepEqual(
		encodeMovingPointInputV1({ type: 'add-point', x: 12, y: 14 }),
		encodeMovingPointInputV1({ type: 'add-point', x: 12, y: 15 }),
	)
})
