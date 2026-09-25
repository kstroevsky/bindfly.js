import assert from 'node:assert/strict'
import test from 'node:test'

import { defineParameterSchema } from '../../../src-v2/core/parameters.ts'
import { appendFormulaPerturbation, createFormulaPerturbationNode, extractFormulaConfiguration } from './formula-perturbation-history.ts'

const schema = defineParameterSchema({
	formulaAX: { kind: 'string', default: 'x', control: 'formula', invalidation: 'hot-update' },
	formulaMorph: { kind: 'number', default: 0, invalidation: 'hot-update' },
	background: { kind: 'string', default: '#000', invalidation: 'hot-update' },
})

test('formula perturbation nodes keep only formula configuration plus frozen-state identity and metrics', () => {
	const parameters = { formulaAX: 'sin(x)', formulaMorph: 0.5, background: '#fff' }
	assert.deepEqual(extractFormulaConfiguration(schema, parameters), { formulaAX: 'sin(x)', formulaMorph: 0.5 })
	const node = createFormulaPerturbationNode({
		id: 'node-1', label: 'Formula AX changed', simulationSnapshotId: 'snapshot-1', schema, parameters,
		metrics: { step: 42, points: 100, edges: 20, components: 3 },
	})
	assert.equal(node.simulationSnapshotId, 'snapshot-1')
	assert.equal(node.metrics.step, 42)
	assert.equal(Object.hasOwn(node.configuration, 'background'), false)
})

test('formula perturbation history is bounded and preserves chronological order', () => {
	const node = (index: number) => createFormulaPerturbationNode({
		id: `node-${index}`, label: `Node ${index}`, simulationSnapshotId: 'snapshot', schema,
		parameters: { formulaAX: String(index), formulaMorph: index, background: '#000' },
		metrics: { step: 1, points: 1, edges: 0, components: 1 },
	})
	let history: readonly ReturnType<typeof node>[] = []
	for (let index = 0; index < 4; index++) history = appendFormulaPerturbation(history, node(index), 3)
	assert.deepEqual(history.map(({ id }) => id), ['node-1', 'node-2', 'node-3'])
})
