import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeParameters } from '../../core/index.ts'
import { createViewport } from '../../core/viewport.ts'
import { compileScalarFieldProgram, createScalarFieldScope, evaluateScalarField } from './formula.ts'
import { scalarFieldDefinition } from './definition.ts'
import { scalarFieldParameters } from './parameters.ts'
import { sampleScalarField } from './sampling.ts'

test('scalar field declares Canvas2D main/worker and WebGL2 main execution', () => {
	assert.deepEqual(scalarFieldDefinition.capabilities.executionProfiles, [
		{ rendererId: 'canvas2d', runtimeId: 'main-thread' },
		{ rendererId: 'canvas2d', runtimeId: 'worker' },
		{ rendererId: 'webgl2', runtimeId: 'main-thread' },
	])
})

test('radial scalar field evaluates its declared coefficient in canonical scope', () => {
	const normalized = normalizeParameters(scalarFieldParameters, { k: 1 })
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return
	const program = compileScalarFieldProgram(normalized.value)
	assert.equal(program.ok, true)
	if (!program.ok) return
	const origin = evaluateScalarField(program.value, createScalarFieldScope(normalized.value, 0, 0))
	const circle = evaluateScalarField(program.value, createScalarFieldScope(normalized.value, 1, 0))
	assert.deepEqual(origin, { ok: true, value: -1 })
	assert.deepEqual(circle, { ok: true, value: 0 })
})

test('scalar-field sampling uses the shared isotropic visible mathematical bounds', () => {
	const normalized = normalizeParameters(scalarFieldParameters, {})
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return
	const program = compileScalarFieldProgram(normalized.value)
	assert.equal(program.ok, true)
	if (!program.ok) return
	const grid = sampleScalarField({
		viewport: createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 }),
		domainRadius: 3,
		sampleDensity: 16,
		evaluate: (x, y) => evaluateScalarField(program.value, createScalarFieldScope(normalized.value, x, y)),
	})
	assert.deepEqual({ minX: grid.minX, maxX: grid.maxX, minY: grid.minY, maxY: grid.maxY }, {
		minX: -4, maxX: 4, minY: -3, maxY: 3,
	})
	assert.equal(grid.invalidCount, 0)
	assert.equal(grid.validCount, grid.columns * grid.rows)
})
