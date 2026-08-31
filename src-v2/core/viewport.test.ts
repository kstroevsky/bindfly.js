import assert from 'node:assert/strict'
import test from 'node:test'

import { createViewport } from './viewport.ts'

test('creates a viewport with separate CSS and backing-store dimensions', () => {
	assert.deepEqual(
		createViewport({ cssWidth: 640, cssHeight: 480, devicePixelRatio: 2 }),
		{
			cssWidth: 640,
			cssHeight: 480,
			devicePixelRatio: 2,
			backingWidth: 1280,
			backingHeight: 960,
		},
	)
})

test('rejects non-finite or non-positive viewport values', () => {
	assert.throws(
		() => createViewport({ cssWidth: 0, cssHeight: 480, devicePixelRatio: 2 }),
		/positive finite/,
	)
})
