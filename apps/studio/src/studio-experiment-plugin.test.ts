import assert from 'node:assert/strict'
import test from 'node:test'

import { droopingLinesPlugin } from './drooping-lines-plugin.ts'
import { flyingLinesPlugin } from './flying-lines-plugin.ts'
import { studioExperimentRegistry } from './studio-experiment-registry.ts'

test('typed plugin is erased only at the heterogeneous registry boundary', async () => {
	assert.deepEqual(studioExperimentRegistry.list(), [
		'drooping-lines', 'flying-lines', 'pulse-2023', 'spiral-1', 'spiral-2', 'spiral-3', 'vector-field-2d',
	])
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
	assert.equal(drooping.defaultParameters.formulaAX, 'tan(x)')
	assert.equal(drooping.defaultParameters.formulaMorph, 0)
	assert.deepEqual(drooping.provenance.map(({ id }) => id), ['drooping-tan-x', 'drooping-atan-y'])
	assert.equal(drooping.parseParameterPatch({ formulaAX: 'globalThis' }).ok, false)
	assert.notDeepEqual(drooping.parameters, plugin.parameters)

	const pulse = await studioExperimentRegistry.load('pulse-2023')
	assert.equal(pulse.title, 'Pulse 2023')
	assert.deepEqual(pulse.provenance.map(({ id }) => id), ['pulse-2023'])
	assert.equal(pulse.defaultParameters.formulaAY, 'positionY + tan(distance) * weight * cos(angle * exp(a)) * atan(a)')
	assert.equal(pulse.parseParameterPatch({ formulaAX: 'globalThis' }).ok, false)
	const pulsePayload = pulse.serializeConfiguration(pulse.defaultParameters, pulse.defaultSeed)
	assert.deepEqual(pulse.parseConfiguration(pulsePayload, pulse.stateVersion), {
		ok: true,
		value: { parameters: pulse.defaultParameters, seed: pulse.defaultSeed },
	})
	assert.deepEqual(pulse.createInteractionController().handle({
		phase: 'down', x: 12, y: 34, buttons: 1, shiftKey: false,
	}), [{ type: 'set-center', x: 12, y: 34 }])
})

test('interaction semantics are supplied by the experiment plugin', () => {
	const interaction = flyingLinesPlugin.createInteractionController()
	const droopingInteraction = droopingLinesPlugin.createInteractionController()
	const handle = (event: Parameters<typeof interaction.handle>[0]) => {
		const flying = interaction.handle(event)
		assert.deepEqual(droopingInteraction.handle(event), flying)
		return flying
	}
	assert.deepEqual(handle({ phase: 'down', x: 10, y: 20, buttons: 1, shiftKey: false }), [])
	assert.deepEqual(handle({ phase: 'up', x: 10, y: 20, buttons: 0, shiftKey: false }), [
		{ type: 'add-point', x: 10, y: 20 },
	])
	assert.deepEqual(handle({ phase: 'down', x: 30, y: 40, buttons: 1, shiftKey: true }), [
		{ type: 'remove-nearest', x: 30, y: 40, maxDistance: 18 },
	])
	assert.deepEqual(handle({ phase: 'down', x: 50, y: 60, buttons: 1, shiftKey: false }), [])
	assert.deepEqual(handle({ phase: 'move', x: 55, y: 65, buttons: 1, shiftKey: false }), [
		{ type: 'move-nearest', fromX: 50, fromY: 60, x: 55, y: 65, maxDistance: 14 },
	])
	assert.deepEqual(handle({ phase: 'up', x: 55, y: 65, buttons: 0, shiftKey: false }), [])
})
