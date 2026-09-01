import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom } from '../../core/index.ts'
import { experimentRegistry } from '../registry.ts'

test('loads Flying Lines by stable registry ID and round-trips durable state', async () => {
	const definition = await experimentRegistry.load('flying-lines')
	assert.equal(definition.id, 'flying-lines')
	assert.deepEqual(definition.capabilities.renderers, ['canvas2d'])
	assert.deepEqual(definition.capabilities.runtimes, ['main-thread'])
	assert.equal(definition.timing.fixedStepSeconds, 1 / 120)

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

test('snapshots copy active typed state without exposing live buffers', async () => {
	const definition = await experimentRegistry.load('flying-lines')
	const preset = definition.presets?.[0]
	assert.ok(preset)
	const simulation = definition.createSimulation({
		random: createSeededRandom('snapshot-test'),
		viewport: { cssWidth: 320, cssHeight: 200, devicePixelRatio: 1, backingWidth: 320, backingHeight: 200 },
	}, preset.parameters)
	const snapshot = definition.capabilities.snapshotState(simulation.state) as { particles: { x: Float64Array } }
	const snapshotX = snapshot.particles.x[0]
	simulation.state.particles.x[0] = (simulation.state.particles.x[0] ?? 0) + 1
	assert.equal(snapshot.particles.x[0], snapshotX)
})
