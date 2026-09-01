import assert from 'node:assert/strict'
import test from 'node:test'

import { defineParameterSchema, normalizeParameters } from '../../../src-v2/core/parameters.ts'
import { createParameterControlModels } from './parameter-control-model.ts'

test('models every supported parameter kind without experiment-specific branches', () => {
	const schema = defineParameterSchema({
		amount: { kind: 'number', default: 2, min: 0, max: 10, units: 'items', invalidation: 'hot-update' },
		enabled: { kind: 'boolean', default: true, invalidation: 'reset-simulation' },
		name: { kind: 'string', default: 'demo', invalidation: 'hot-update' },
		mode: { kind: 'enum', default: 'a', values: ['a', 'b'] as const, invalidation: 'rebuild-runtime' },
	})
	const values = normalizeParameters(schema, {})
	assert.equal(values.ok, true)
	if (!values.ok) return
	const models = createParameterControlModels(schema, values.value)
	assert.deepEqual(models.map(({ id, definition }) => [id, definition.kind]), [
		['amount', 'number'], ['enabled', 'boolean'], ['name', 'string'], ['mode', 'enum'],
	])
	assert.equal(models[0]?.label, 'Amount')
	assert.equal(models[0]?.units, 'items')
	assert.equal(models[3]?.invalidation, 'rebuild-runtime')
})
