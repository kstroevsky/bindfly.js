import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom } from '../../core/random.ts'
import { droopingLinesDefinition } from './definition.ts'

test('defines Drooping Lines with typed state and its two original deformation presets', () => {
	const definition = droopingLinesDefinition
	assert.equal(definition.id, 'drooping-lines')
	assert.deepEqual(definition.capabilities.executionProfiles, [
		{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
		{ rendererId: 'canvas2d', runtimeId: 'worker' },
	])
	assert.deepEqual(definition.presets?.map(({ id, parameters }) => [id, parameters.deformation]), [
		['simple', 'tan-x'],
		['add-by-click', 'atan-y'],
	])
	const preset = definition.presets?.[0]
	assert.ok(preset)
	const simulation = definition.createSimulation({
		random: createSeededRandom('drooping-definition'),
		viewport: { cssWidth: 320, cssHeight: 200, devicePixelRatio: 1, backingWidth: 320, backingHeight: 200 },
	}, preset.parameters)
	assert.equal(simulation.state.particles.count, 100)
})
