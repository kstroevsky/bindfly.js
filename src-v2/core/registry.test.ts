import assert from 'node:assert/strict'
import test from 'node:test'

import { createExperimentRegistry } from './registry.ts'

test('loads an experiment by explicit stable ID', async () => {
	const registry = createExperimentRegistry<{ id: string }>()
	registry.register({
		id: 'flying-lines',
		load: () => Promise.resolve({ default: { id: 'flying-lines' } }),
	})

	assert.deepEqual(registry.list(), ['flying-lines'])
	assert.deepEqual(await registry.load('flying-lines'), { id: 'flying-lines' })
})

test('rejects duplicate registrations', () => {
	const registry = createExperimentRegistry<{ id: string }>()
	const descriptor = {
		id: 'flying-lines',
		load: () => Promise.resolve({ default: { id: 'flying-lines' } }),
	}

	registry.register(descriptor)
	assert.throws(() => registry.register(descriptor), /already registered/)
})

test('rejects unknown IDs and loader identity mismatches', async () => {
	const registry = createExperimentRegistry<{ id: string }>()
	registry.register({
		id: 'flying-lines',
		load: () => Promise.resolve({ default: { id: 'different-id' } }),
	})

	await assert.rejects(() => registry.load('missing'), /not registered/)
	await assert.rejects(() => registry.load('flying-lines'), /loaded definition ID/)
})
