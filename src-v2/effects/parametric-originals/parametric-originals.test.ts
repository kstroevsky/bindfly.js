import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom, createViewport } from '../../core/index.ts'
import { bindflyOriginals } from '../../formula/index.ts'
import { createParametricOriginalDefinition, parametricOriginalDefinitions } from './definition.ts'
import { compileParametricOriginalFormulaPair } from './formula.ts'
import { createParametricOriginalParameters } from './parameters.ts'
import { createParametricPointDerivation } from './points.ts'

const viewport = createViewport({ cssWidth: 320, cssHeight: 200, devicePixelRatio: 1 })
const step = { index: 0, dtSeconds: 1 / 120, elapsedSeconds: 1 / 120 }

test('registers Pulse and all three Spiral originals with truthful execution profiles', () => {
	assert.deepEqual(parametricOriginalDefinitions.map(({ definition }) => definition.id), [
		'pulse-2023', 'spiral-1', 'spiral-2', 'spiral-3',
	])
	for (const { definition } of parametricOriginalDefinitions) {
		assert.deepEqual(definition.capabilities.executionProfiles, [
			{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
			{ rendererId: 'canvas2d', runtimeId: 'worker' },
		])
	}
})

test('advances the preserved legacy accumulator once per fixed step in index order', () => {
	const bundle = createParametricOriginalDefinition({ id: 'spiral-1', kind: 'spiral', legacyRouteName: 'Spiral' })
	const preset = bundle.definition.presets?.[0]
	assert.ok(preset)
	const parameters = { ...preset.parameters, particleCount: 3 }
	const simulation = bundle.definition.createSimulation({ random: createSeededRandom('parametric-test'), viewport }, parameters)
	simulation.step(step)
	let expectedAccumulator = 2.6
	const expected = Array.from({ length: 3 }, () => (expectedAccumulator -= 0.999995))
	assert.deepEqual([...simulation.state.phases.values], expected)
	assert.equal(simulation.state.accumulator, -0.3999849999999998)
	simulation.reset()
	assert.deepEqual([...simulation.state.phases.values], [2.6, 2.6, 2.6])
})

test('keeps Pulse two-operation accumulator semantics distinct from Spiral', () => {
	const bundle = createParametricOriginalDefinition({ id: 'pulse-2023', kind: 'pulse', legacyRouteName: 'Pulse' })
	const preset = bundle.definition.presets?.[0]
	assert.ok(preset)
	const simulation = bundle.definition.createSimulation(
		{ random: createSeededRandom('pulse-phase-test'), viewport },
		{ ...preset.parameters, particleCount: 3 },
	)
	simulation.step(step)
	let expected = 2.6
	const pulseValues = Array.from({ length: 3 }, () => {
		expected += -1
		expected += 0.000005
		return expected
	})
	assert.deepEqual([...simulation.state.phases.values], pulseValues)
	let spiralEquivalent = 2.6
	for (let index = 0; index < 3; index++) spiralEquivalent += -0.999995
	assert.notEqual(expected, spiralEquivalent)
})

test('derives exact Spiral II coordinates through formula IR', () => {
	const original = bindflyOriginals['spiral-2']
	const schema = createParametricOriginalParameters(original)
	const defaults = Object.fromEntries(Object.entries(schema).map(([id, definition]) => [id, definition.default]))
	const formulas = compileParametricOriginalFormulaPair(defaults as never)
	assert.equal(formulas.ok, true)
	if (!formulas.ok) return
	const derivation = createParametricPointDerivation(4)
	const state = {
		phases: { count: 2, capacity: 2, values: new Float64Array([2.7, 2.8]) },
		accumulator: 2.8,
		reverse: false,
		centerX: 160,
		centerY: 100,
	}
	const points = derivation.update({
		state,
		kind: 'spiral',
		viewportWidth: 320,
		viewportHeight: 200,
		weight: 10,
		formulaA: formulas.value.a,
		formulaB: formulas.value.b,
		formulaMorph: 0,
	})
	const angle = Math.PI + Math.PI / 4
	const distance = 100 * (angle / (2 * Math.PI)) * 2
	assert.equal(points.x[1], 160 + distance * Math.cos(angle * Math.exp(2.8)) * Math.atan(2.8))
	assert.equal(points.y[1], 100 + distance * Math.cos(2.8) * -1)
	assert.equal(points.invalidFormulaPointCount, 0)
})
