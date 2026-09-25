import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom, createViewport } from '../../core/index.ts'
import { bindflyOriginals } from '../../formula/index.ts'
import { createParametricOriginalDefinition, parametricOriginalDefinitions } from './definition.ts'
import { compileParametricOriginalFormulaPair } from './formula.ts'
import { createParametricOriginalParameters } from './parameters.ts'
import {
	FORMULA_COMPARISON_VALIDITY,
	createParametricComparisonPointViewDerivation,
	createParametricFormulaComparisonDerivation,
	createParametricPointDerivation,
	probeParametricFormulaPoint,
} from './points.ts'

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

test('Controlled phase holds one declared phase for every point without changing Original mode', () => {
	const bundle = createParametricOriginalDefinition({ id: 'spiral-1', kind: 'spiral', legacyRouteName: 'Spiral' })
	const preset = bundle.definition.presets?.[0]
	assert.ok(preset)
	const controlled = bundle.definition.createSimulation(
		{ random: createSeededRandom('controlled-phase'), viewport },
		{ ...preset.parameters, particleCount: 3, phaseMode: 'Controlled phase · mathematical variant', controlledPhase: 1.25 },
	)
	assert.deepEqual([...controlled.state.phases.values], [1.25, 1.25, 1.25])
	controlled.step(step)
	assert.deepEqual([...controlled.state.phases.values], [1.25, 1.25, 1.25])
	assert.equal(controlled.state.accumulator, 1.25)

	const original = bundle.definition.createSimulation(
		{ random: createSeededRandom('controlled-phase'), viewport },
		{ ...preset.parameters, particleCount: 3, phaseMode: 'Original', controlledPhase: 1.25 },
	)
	original.step(step)
	let expectedAccumulator = 2.6
	assert.deepEqual([...original.state.phases.values], Array.from({ length: 3 }, () => (expectedAccumulator -= 0.999995)))
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
		formulaParameters: { k: 1, b: 0 },
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

test('derives A, B, morph and displacement once with side-specific validity', () => {
	const a = compileParametricOriginalFormulaPair({
		formulaAX: 'sqrt(a)',
		formulaAY: 'positionY',
		formulaBX: 'positionX + a',
		formulaBY: 'positionY + weight',
	} as never)
	assert.equal(a.ok, true)
	if (!a.ok) return
	const comparison = createParametricFormulaComparisonDerivation(4)
	const state = {
		phases: { count: 2, capacity: 2, values: new Float64Array([-1, 4]) },
		accumulator: 4,
		reverse: false,
		centerX: 160,
		centerY: 100,
	}
	const result = comparison.update({
		state,
		kind: 'spiral',
		viewportWidth: 320,
		viewportHeight: 200,
		weight: 10,
		formulaParameters: { k: 1, b: 0 },
		formulaA: a.value.a,
		formulaB: a.value.b,
		formulaMorph: 0.25,
	})

	assert.equal(result.count, 2)
	assert.equal(result.validity[0], FORMULA_COMPARISON_VALIDITY.aInvalid)
	assert.equal(Number.isNaN(result.ax[0]), true)
	assert.equal(result.bx[0], 159)
	assert.equal(Number.isNaN(result.magnitude[0]), true)
	assert.equal(result.validity[1], FORMULA_COMPARISON_VALIDITY.bothValid)
	assert.equal(result.ax[1], 2)
	assert.equal(result.bx[1], 164)
	assert.equal(result.mx[1], 42.5)
	assert.equal(result.my[1], 102.5)
	assert.equal(result.dx[1], 162)
	assert.equal(result.dy[1], 10)
	assert.equal(result.magnitude[1], Math.hypot(162, 10))

	const view = createParametricComparisonPointViewDerivation(4, 'a')
	const aPoints = view.update(result)
	assert.equal(aPoints.count, 1)
	assert.equal(aPoints.ids[0], 1)
	assert.equal(aPoints.x[0], 2)
})

test('probes one point with the canonical scope and VM trace', () => {
	const formulas = compileParametricOriginalFormulaPair({
		formulaAX: 'positionX + distance * cos(a)',
		formulaAY: 'positionY + tan(distance) * weight',
		formulaBX: 'positionX + distance * sin(a)',
		formulaBY: 'positionY + distance',
	} as never)
	assert.equal(formulas.ok, true)
	if (!formulas.ok) return
	const state = {
		phases: { count: 1, capacity: 1, values: new Float64Array([0.5]) },
		accumulator: 0.5, reverse: false, centerX: 100, centerY: 80,
	}
	const probe = probeParametricFormulaPoint({
		state, kind: 'spiral', viewportWidth: 320, viewportHeight: 200, weight: 2,
		formulaParameters: { k: 1, b: 0 },
		formulaA: formulas.value.a, formulaB: formulas.value.b, formulaMorph: 0.25,
	}, 0, 17)
	assert.equal(probe.pointId, 0)
	assert.equal(probe.simulationStep, 17)
	assert.equal(probe.scope.a, 0.5)
	assert.ok(probe.a.x.trace.some(({ expression }) => expression === 'cos(a)'))
	assert.ok(probe.a.x.trace.some(({ expression }) => expression === 'distance * cos(a)'))
	assert.equal(probe.validity, FORMULA_COMPARISON_VALIDITY.bothValid)
	assert.ok(probe.displacement)
})

test('declared k and b coefficients are canonical formula variables', () => {
	const formulas = compileParametricOriginalFormulaPair({
		formulaAX: 'positionX + k * distance + b',
		formulaAY: 'positionY',
		formulaBX: 'positionX',
		formulaBY: 'positionY',
	} as never)
	assert.equal(formulas.ok, true)
	if (!formulas.ok) return
	const state = {
		phases: { count: 1, capacity: 1, values: new Float64Array([0.5]) },
		accumulator: 0.5, reverse: false, centerX: 100, centerY: 80,
	}
	const probe = probeParametricFormulaPoint({
		state, kind: 'spiral', viewportWidth: 320, viewportHeight: 200, weight: 2,
		formulaParameters: { k: 2, b: 3 },
		formulaA: formulas.value.a, formulaB: formulas.value.b, formulaMorph: 0,
	}, 0, 1)
	assert.equal(probe.scope.k, 2)
	assert.equal(probe.scope.b, 3)
	assert.equal(probe.a.x.value, 103)
})
