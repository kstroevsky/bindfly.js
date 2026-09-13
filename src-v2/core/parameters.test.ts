import assert from 'node:assert/strict'
import test from 'node:test'

import { defineParameterSchema, getParameterPatchInvalidation, normalizeParameters } from './parameters.ts'

const schema = defineParameterSchema({
	particles: {
		kind: 'number',
		default: 100,
		min: 1,
		max: 500,
		step: 1,
		invalidation: 'reset-simulation',
	},
	clickable: {
		kind: 'boolean',
		default: true,
		invalidation: 'hot-update',
	},
	integrator: {
		kind: 'enum',
		default: 'rk4',
		values: ['euler', 'rk4'],
		invalidation: 'reset-simulation',
	},
	runtimeMode: {
		kind: 'enum',
		default: 'main',
		values: ['main', 'worker'],
		invalidation: 'rebuild-runtime',
	},
})

test('normalizes a partial parameter input with defaults', () => {
	assert.deepEqual(normalizeParameters(schema, { particles: 300 }), {
		ok: true,
		value: { particles: 300, clickable: true, integrator: 'rk4', runtimeMode: 'main' },
	})
})

test('rejects invalid values and unknown parameter IDs without partial state', () => {
	const result = normalizeParameters(schema, {
		particles: 501,
		clickable: 'yes',
		integrator: 'midpoint',
		unknown: 1,
	})

	assert.equal(result.ok, false)
	if (result.ok) return

	assert.deepEqual(
		result.issues.map(({ code, parameterId }) => `${parameterId}:${code}`).sort(),
		[
			'clickable:invalid-type',
			'integrator:invalid-enum-value',
			'particles:above-maximum',
			'unknown:unknown-parameter',
		],
	)
})

test('rejects numbers that do not align to the declared step', () => {
	assert.deepEqual(normalizeParameters(schema, { particles: 1.5 }), {
		ok: false,
		issues: [
			{
				code: 'invalid-step',
				message: "Parameter 'particles' must align to step 1 from base 1.",
				parameterId: 'particles',
			},
		],
	})
})

test('rejects invalid schema definitions before runtime input exists', () => {
	assert.throws(() => defineParameterSchema({
		value: {
			kind: 'number',
			default: 1,
			step: 0,
			invalidation: 'hot-update',
		},
	}), /positive finite step/)

	assert.throws(() => defineParameterSchema({
		mode: {
			kind: 'enum',
			default: 'missing',
			values: ['present'],
			invalidation: 'reset-simulation',
		},
	}), /include its default/)
})

test('classifies a patch by its strongest declared invalidation', () => {
	assert.equal(getParameterPatchInvalidation(schema, { clickable: false }), 'hot-update')
	assert.equal(getParameterPatchInvalidation(schema, { particles: 6 }), 'reset-simulation')
	assert.equal(getParameterPatchInvalidation(schema, { clickable: false, particles: 6 }), 'reset-simulation')
	assert.equal(getParameterPatchInvalidation(schema, { particles: 6, runtimeMode: 'worker' }), 'rebuild-runtime')
})
