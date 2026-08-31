import assert from 'node:assert/strict'
import test from 'node:test'

import { experimentRegistry } from '../registry.ts'

test('loads Flying Lines by stable registry ID and round-trips durable state', async () => {
	const definition = await experimentRegistry.load('flying-lines')
	assert.equal(definition.id, 'flying-lines')
	assert.deepEqual(definition.capabilities.renderers, ['canvas2d'])
	assert.deepEqual(definition.capabilities.runtimes, ['main-thread'])

	const preset = definition.presets?.[0]
	assert.ok(preset)
	const durable = { parameters: preset.parameters, seed: 'phase-3-default' }
	const serialized = definition.stateCodec.serialize(durable)
	assert.deepEqual(definition.stateCodec.parse(serialized), { ok: true, value: durable })
})

test('rejects malformed Flying Lines durable state', async () => {
	const definition = await experimentRegistry.load('flying-lines')
	assert.equal(definition.stateCodec.parse('{').ok, false)
	assert.equal(definition.stateCodec.parse(JSON.stringify({ seed: '', parameters: {} })).ok, false)
})
