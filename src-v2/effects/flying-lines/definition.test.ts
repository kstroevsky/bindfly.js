import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom } from '../../core/index.ts'
import { flyingLinesDefinition } from './definition.ts'

test('defines Flying Lines by stable ID and round-trips durable state', () => {
	const definition = flyingLinesDefinition
	assert.equal(definition.id, 'flying-lines')
	assert.deepEqual(definition.capabilities.executionProfiles, [
		{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
		{ rendererId: 'canvas2d', runtimeId: 'worker' },
	])
	assert.equal(definition.timing.fixedStepSeconds, 1 / 120)

	const preset = definition.presets?.[0]
	assert.ok(preset)
	const durable = { parameters: preset.parameters, seed: 'phase-3-default' }
	const serialized = definition.stateCodec.serialize(durable)
	assert.deepEqual(definition.stateCodec.parse(serialized), { ok: true, value: durable })
})

test('rejects malformed Flying Lines durable state', () => {
	const definition = flyingLinesDefinition
	assert.equal(definition.stateCodec.parse('{').ok, false)
	assert.equal(definition.stateCodec.parse(JSON.stringify({ seed: '', parameters: {} })).ok, false)
})

test('snapshots copy active typed state without exposing live buffers', () => {
	const definition = flyingLinesDefinition
	const preset = definition.presets?.[0]
	assert.ok(preset)
	const simulation = definition.createSimulation({
		random: createSeededRandom('snapshot-test'),
		viewport: { cssWidth: 320, cssHeight: 200, devicePixelRatio: 1, backingWidth: 320, backingHeight: 200 },
	}, preset.parameters)
	const snapshot = definition.capabilities.snapshotState(simulation.state)
	const snapshotX = snapshot.particles.x[0]
	simulation.state.particles.x[0] = (simulation.state.particles.x[0] ?? 0) + 1
	assert.equal(snapshot.particles.x[0], snapshotX)
})
