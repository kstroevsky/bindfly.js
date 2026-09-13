import assert from 'node:assert/strict'
import test from 'node:test'

import { flyingLinesPlugin } from './flying-lines-plugin.ts'
import { studioExperimentRegistry } from './studio-experiment-registry.ts'

test('typed plugin is erased only at the heterogeneous registry boundary', async () => {
	assert.deepEqual(studioExperimentRegistry.list(), ['drooping-lines', 'flying-lines'])
	const plugin = await studioExperimentRegistry.load('flying-lines')
	assert.equal(plugin, flyingLinesPlugin)
	assert.equal(plugin.title, 'Flying Lines')
	assert.deepEqual(plugin.executionProfiles, [
		{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
		{ rendererId: 'canvas2d', runtimeId: 'worker' },
	])
	assert.equal(plugin.defaultParameters.particleCount, 100)
	assert.equal(plugin.parseParameterPatch({ unknown: 1 }).ok, false)

	const payload = plugin.serializeConfiguration(plugin.defaultParameters, plugin.defaultSeed)
	assert.deepEqual(plugin.parseConfiguration(payload, plugin.stateVersion), {
		ok: true,
		value: { parameters: plugin.defaultParameters, seed: plugin.defaultSeed },
	})

	const drooping = await studioExperimentRegistry.load('drooping-lines')
	assert.equal(drooping.title, 'Drooping Lines')
	assert.equal(drooping.defaultParameters.deformation, 'tan-x')
	assert.equal(drooping.parseParameterPatch({ deformation: 'missing' }).ok, false)
	assert.notDeepEqual(drooping.parameters, plugin.parameters)
})

test('interaction semantics are supplied by the experiment plugin', () => {
	const interaction = flyingLinesPlugin.createInteractionController()
	assert.deepEqual(interaction.handle({ phase: 'down', x: 10, y: 20, buttons: 1, shiftKey: false }), [])
	assert.deepEqual(interaction.handle({ phase: 'up', x: 10, y: 20, buttons: 0, shiftKey: false }), [
		{ type: 'add-point', x: 10, y: 20 },
	])
	assert.deepEqual(interaction.handle({ phase: 'down', x: 30, y: 40, buttons: 1, shiftKey: true }), [
		{ type: 'remove-nearest', x: 30, y: 40, maxDistance: 18 },
	])
	assert.deepEqual(interaction.handle({ phase: 'down', x: 50, y: 60, buttons: 1, shiftKey: false }), [])
	assert.deepEqual(interaction.handle({ phase: 'move', x: 55, y: 65, buttons: 1, shiftKey: false }), [
		{ type: 'move-nearest', fromX: 50, fromY: 60, x: 55, y: 65, maxDistance: 14 },
	])
	assert.deepEqual(interaction.handle({ phase: 'up', x: 55, y: 65, buttons: 0, shiftKey: false }), [])
})
