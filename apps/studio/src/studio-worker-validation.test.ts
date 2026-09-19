import assert from 'node:assert/strict'
import test from 'node:test'

import { parseStudioWorkerInitializePayload, parseStudioWorkerViewport } from './studio-worker-validation.ts'

const viewport = { cssWidth: 320, cssHeight: 180, devicePixelRatio: 2, backingWidth: 640, backingHeight: 360 }

test('generic worker validation keeps experiment payload opaque until plugin validation', () => {
	const result = parseStudioWorkerInitializePayload({
		canvas: { getContext: () => null },
		experimentId: 'drooping-lines',
		parameters: { formulaMorph: 1 },
		seed: 'drooping-worker',
		viewport,
	})
	assert.equal(result.experimentId, 'drooping-lines')
	assert.deepEqual(result.parameters, { formulaMorph: 1 })
	assert.deepEqual(result.viewport, viewport)
})

test('generic worker validation rejects malformed transport-owned fields', () => {
	assert.throws(() => parseStudioWorkerViewport({ ...viewport, backingHeight: 359 }), /backing dimensions/)
	assert.throws(() => parseStudioWorkerInitializePayload({
		canvas: {}, experimentId: 'flying-lines', parameters: {}, seed: 'seed', viewport,
	}), /getContext/)
	assert.throws(() => parseStudioWorkerInitializePayload({
		canvas: { getContext: () => null }, experimentId: '', parameters: {}, seed: 'seed', viewport,
	}), /experimentId/)
})
