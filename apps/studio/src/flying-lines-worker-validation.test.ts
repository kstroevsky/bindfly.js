import assert from 'node:assert/strict'
import test from 'node:test'

import { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import {
	parseFlyingLinesWorkerInitializePayload,
	parseFlyingLinesWorkerInput,
	parseFlyingLinesWorkerParameterPatch,
	parseFlyingLinesWorkerViewport,
} from './flying-lines-worker-validation.ts'

const viewport = {
	cssWidth: 320,
	cssHeight: 180,
	devicePixelRatio: 2,
	backingWidth: 640,
	backingHeight: 360,
}

test('worker validators accept valid payloads and preserve patch scope', () => {
	const payload = parseFlyingLinesWorkerInitializePayload({
		canvas: { getContext: () => null },
		viewport,
		parameters: Object.fromEntries(Object.entries(flyingLinesParameters).map(([id, definition]) => [id, definition.default])),
		seed: 'worker-seed',
	})
	assert.equal(payload.seed, 'worker-seed')
	assert.deepEqual(payload.viewport, viewport)
	assert.deepEqual(parseFlyingLinesWorkerParameterPatch({ background: '#fff' }), { background: '#fff' })
	assert.deepEqual(parseFlyingLinesWorkerInput({ type: 'move-point', id: 7, x: 12, y: 14 }), {
		type: 'move-point', id: 7, x: 12, y: 14,
	})
})

test('worker validators reject malformed viewport and initialization payloads', () => {
	assert.throws(() => parseFlyingLinesWorkerViewport({ ...viewport, backingWidth: 639 }), /backing dimensions/)
	assert.throws(() => parseFlyingLinesWorkerViewport({ ...viewport, cssWidth: Number.NaN }), /finite number/)
	assert.throws(() => parseFlyingLinesWorkerInitializePayload({
		canvas: {}, viewport, parameters: {}, seed: 'worker-seed',
	}), /getContext/)
	assert.throws(() => parseFlyingLinesWorkerInitializePayload({
		canvas: { getContext: () => null }, viewport, parameters: {}, seed: '',
	}), /non-empty string/)
})

test('worker validators reject unknown or invalid parameter patches', () => {
	assert.throws(() => parseFlyingLinesWorkerParameterPatch({ unknown: 1 }), /Unknown parameter/)
	assert.throws(() => parseFlyingLinesWorkerParameterPatch({ particleCount: 1.5 }), /align to step/)
	assert.throws(() => parseFlyingLinesWorkerParameterPatch(null), /must be an object/)
})

test('worker validators reject invalid domain inputs', () => {
	assert.throws(() => parseFlyingLinesWorkerInput({ type: 'unknown' }), /unsupported/)
	assert.throws(() => parseFlyingLinesWorkerInput({ type: 'add-point', x: Number.NaN, y: 1 }), /finite number/)
	assert.throws(() => parseFlyingLinesWorkerInput({ type: 'move-point', id: -1, x: 1, y: 2 }), /non-negative integer/)
	assert.throws(() => parseFlyingLinesWorkerInput({
		type: 'remove-nearest', x: 1, y: 2, maxDistance: -1,
	}), /non-negative/)
})
