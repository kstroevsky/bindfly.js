import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeParameters } from '../../core/index.ts'
import { createViewport } from '../../core/viewport.ts'
import { compileVectorFieldPrograms, createVectorFieldScope, evaluateVectorField } from './formula.ts'
import { vectorFieldParameters } from './parameters.ts'
import { createVectorFieldSimulation } from './simulation.ts'
import { vectorFieldDefinition } from './definition.ts'

const viewport = createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 })

test('vector field declares Canvas2D main/worker and WebGL2 main execution', () => {
	assert.deepEqual(vectorFieldDefinition.capabilities.executionProfiles, [
		{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
		{ rendererId: 'canvas2d', runtimeId: 'worker' },
		{ rendererId: 'webgl2', runtimeId: 'main-thread' },
	])
})

test('RK4 advances a continuous vector field with fourth-order accuracy', () => {
	const normalized = normalizeParameters(vectorFieldParameters, {
		dxFormula: 'x', dyFormula: '-y', mu: 0.8, domainRadius: 3, fieldDensity: 15,
		trailLength: 384, background: '#000',
	})
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return
	const programs = compileVectorFieldPrograms(normalized.value)
	assert.equal(programs.ok, true)
	if (!programs.ok) return
	const simulation = createVectorFieldSimulation({
		parameters: normalized.value,
		viewport,
		evaluate: (x, y, t) => evaluateVectorField(programs.value, createVectorFieldScope(normalized.value, x, y, t)),
	})
	simulation.state.trajectories[0] = { id: 0, x: 1, y: 1, status: 'active', trailX: [1], trailY: [1], trailEpochs: [0] }
	simulation.step({ index: 1, dtSeconds: 0.1, elapsedSeconds: 0.1 })
	assert.ok(Math.abs((simulation.state.trajectories[0]?.x ?? 0) - Math.exp(0.1)) < 1e-6)
	assert.ok(Math.abs((simulation.state.trajectories[0]?.y ?? 0) - Math.exp(-0.1)) < 1e-6)
})

test('click input creates a mathematical initial condition from canvas coordinates', () => {
	const normalized = normalizeParameters(vectorFieldParameters, {})
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return
	const programs = compileVectorFieldPrograms(normalized.value)
	assert.equal(programs.ok, true)
	if (!programs.ok) return
	const simulation = createVectorFieldSimulation({
		parameters: normalized.value,
		viewport,
		evaluate: (x, y, t) => evaluateVectorField(programs.value, createVectorFieldScope(normalized.value, x, y, t)),
	})
	simulation.applyInput({ type: 'add-initial-condition', x: 300, y: 75 })
	assert.equal(simulation.state.trajectories.length, 2)
	assert.equal(simulation.state.trajectories[1]?.x, 2)
	assert.equal(simulation.state.trajectories[1]?.y, 1.5)
})
