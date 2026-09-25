import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeParameters } from '../../core/index.ts'
import { createViewport } from '../../core/viewport.ts'
import { compileDiscreteMapPrograms, createDiscreteMapScope, evaluateDiscreteMap } from './formula.ts'
import { discreteMapDefinition } from './definition.ts'
import { discreteMapParameters } from './parameters.ts'
import { createDiscreteMapSimulation } from './simulation.ts'

const viewport = createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 })

test('discrete map declares main-thread and Worker Canvas2D execution', () => {
	assert.deepEqual(discreteMapDefinition.capabilities.executionProfiles, [
		{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
		{ rendererId: 'canvas2d', runtimeId: 'worker' },
	])
})

const createSimulation = (overrides: Record<string, unknown>) => {
	const normalized = normalizeParameters(discreteMapParameters, overrides)
	assert.equal(normalized.ok, true)
	if (!normalized.ok) throw new Error('Test parameters failed normalization.')
	const programs = compileDiscreteMapPrograms(normalized.value)
	assert.equal(programs.ok, true)
	if (!programs.ok) throw new Error('Test formulas failed compilation.')
	return createDiscreteMapSimulation({
		parameters: normalized.value,
		viewport,
		evaluate: (x, y, n) => evaluateDiscreteMap(programs.value, createDiscreteMapScope(normalized.value, x, y, n)),
	})
}

test('Hénon map advances both coordinates simultaneously once per Step', () => {
	const simulation = createSimulation({})
	simulation.step({ index: 1, dtSeconds: 1 / 12, elapsedSeconds: 1 / 12 })
	assert.equal(simulation.state.iteration, 1)
	assert.equal(simulation.state.orbits[0]?.x, 1)
	assert.equal(simulation.state.orbits[0]?.y, 0)
	simulation.step({ index: 2, dtSeconds: 1 / 12, elapsedSeconds: 2 / 12 })
	assert.ok(Math.abs((simulation.state.orbits[0]?.x ?? 0) + 0.4) < 1e-12)
	assert.ok(Math.abs((simulation.state.orbits[0]?.y ?? 0) - 0.3) < 1e-12)
})

test('the same map family expresses a logistic recurrence with delay embedding', () => {
	const simulation = createSimulation({
		nextXFormula: 'a*x*(1-x)',
		nextYFormula: 'x',
		a: 3.5,
	})
	simulation.state.orbits[0] = { id: 0, x: 0.2, y: 0, status: 'active', trailX: [0.2], trailY: [0], trailEpochs: [0] }
	simulation.step({ index: 1, dtSeconds: 1 / 12, elapsedSeconds: 1 / 12 })
	assert.ok(Math.abs((simulation.state.orbits[0]?.x ?? 0) - 0.56) < 1e-12)
	assert.ok(Math.abs((simulation.state.orbits[0]?.y ?? 0) - 0.2) < 1e-12)
	simulation.step({ index: 2, dtSeconds: 1 / 12, elapsedSeconds: 2 / 12 })
	assert.ok(Math.abs((simulation.state.orbits[0]?.x ?? 0) - 0.8624) < 1e-12)
	assert.ok(Math.abs((simulation.state.orbits[0]?.y ?? 0) - 0.56) < 1e-12)
})
