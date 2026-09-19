import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom } from '../../core/random.ts'
import { droopingLinesDefinition } from './definition.ts'

test('defines Drooping Lines with editable formula sources and its two original endpoint presets', () => {
	const definition = droopingLinesDefinition
	assert.equal(definition.id, 'drooping-lines')
	assert.deepEqual(definition.capabilities.executionProfiles, [
		{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
		{ rendererId: 'canvas2d', runtimeId: 'worker' },
	])
	assert.deepEqual(definition.presets?.map(({ id, parameters }) => [id, parameters.formulaMorph]), [
		['simple', 0],
		['add-by-click', 1],
	])
	assert.equal(definition.stateVersion, 2)
	assert.equal(definition.parameters.formulaAX.default, 'tan(x)')
	assert.equal(definition.parameters.formulaBY.default, 'atan(y)')
	const preset = definition.presets?.[0]
	assert.ok(preset)
	const simulation = definition.createSimulation({
		random: createSeededRandom('drooping-definition'),
		viewport: { cssWidth: 320, cssHeight: 200, devicePixelRatio: 1, backingWidth: 320, backingHeight: 200 },
	}, preset.parameters)
	assert.equal(simulation.state.particles.count, 100)
})

test('migrates v1 deformation state to the formula-backed state without changing its preset meaning', () => {
	const base = {
		particleCount: 100,
		maxSpeed: 60,
		connectionRadius: 250,
		particleLifetimeSeconds: 20,
		margin: 20,
		background: '#050508',
	}
	for (const [deformation, formulaMorph] of [['tan-x', 0], ['atan-y', 1]] as const) {
		const migrated = droopingLinesDefinition.stateCodec.migrate(JSON.stringify({
			seed: 'migration-seed',
			parameters: { ...base, deformation },
		}), { experimentId: 'drooping-lines', fromVersion: 1, toVersion: 2 })
		assert.equal(migrated.ok, true)
		if (!migrated.ok) continue
		const parsed = droopingLinesDefinition.stateCodec.parse(migrated.value)
		assert.equal(parsed.ok, true)
		if (!parsed.ok) continue
		assert.equal(parsed.value.parameters.formulaMorph, formulaMorph)
		assert.equal(parsed.value.parameters.formulaAX, 'tan(x)')
		assert.equal(parsed.value.parameters.formulaBY, 'atan(y)')
	}
})

test('rejects invalid imported formula source at the durable-state boundary', () => {
	const parameters = droopingLinesDefinition.presets?.[0]?.parameters
	assert.ok(parameters)
	const parsed = droopingLinesDefinition.stateCodec.parse(JSON.stringify({
		seed: 'untrusted-formula',
		parameters: { ...parameters, formulaAX: 'globalThis.alert(1)' },
	}))
	assert.equal(parsed.ok, false)
	if (!parsed.ok) assert.match(parsed.error, /formulas are invalid/)
})
