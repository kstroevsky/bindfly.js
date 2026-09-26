import assert from 'node:assert/strict'
import test from 'node:test'

import { createPointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import { defineParameterSchema } from '../../../src-v2/core/parameters.ts'
import {
	createParameterSweepPlan,
	createSweepValues,
	getSweepableFormulaParameters,
	runParameterSweep,
} from './parameter-sweep.ts'

const schema = defineParameterSchema({
	k: { kind: 'number', default: 1, min: 0, max: 2, step: 0.5, semantic: 'formula-parameter', invalidation: 'hot-update' },
	radius: { kind: 'number', default: 10, min: 1, max: 100, step: 1, invalidation: 'hot-update' },
})

test('parameter sweep values are restricted to declared formula parameters and bounded samples', () => {
	assert.deepEqual(getSweepableFormulaParameters(schema).map(({ id }) => id), ['k'])
	assert.deepEqual(createSweepValues(schema.k, { start: 0, end: 2, step: 0.5 }), [0, 0.5, 1, 1.5, 2])
	assert.throws(() => createSweepValues(schema.radius, { start: 1, end: 2, step: 1 }), /declared formula parameter/)
	assert.throws(() => createSweepValues(schema.k, { start: 0, end: 2, step: 0.1 }), /declared parameter step/)
	assert.throws(() => createSweepValues(schema.k, { start: 0, end: 2, step: 0.5 }, 4), /sample product budget/)
})

test('frozen sweep rejects samples from a different simulation step and records analyzer provenance', async () => {
	const plan = createParameterSweepPlan({
		mode: 'frozen-formula', experimentId: 'fixture', experimentStateVersion: 1,
		baseExperimentPayload: '{"fixture":true}', seed: 'seed', parameterId: 'k', values: [0, 1], source: 'morph', epsilon: 2,
		viewport: { width: 100, height: 100 },
		anchor: { kind: 'frozen-simulation', simulationSnapshotId: 'frozen-1', simulationStep: 4 },
	})
	const snapshot = (step: number, value: number) => createPointCloudSnapshot({
		snapshotId: `snapshot-${value}`, experimentId: 'fixture', stateVersion: 1, simulationStep: step, source: 'morph',
		formulaConfigurationHash: `hash-${value}`,
		points: { count: 2, capacity: 2, ids: new Uint32Array([1, 2]), x: new Float64Array([0, value + 1]), y: new Float64Array([0, 0]) },
	})
	const result = await runParameterSweep(plan, async (value) => snapshot(4, value))
	assert.equal(result.analyzer.approximation, 'full-point-cloud')
	assert.equal(result.samples.length, 2)
	assert.equal(result.samples[0]?.beta0, 1)
	await assert.rejects(runParameterSweep(plan, async (value, index) => snapshot(index === 0 ? 4 : 5, value)), /changed the simulation step/)
})

test('dynamic sweep requires every sample to run the same declared step count', async () => {
	const plan = createParameterSweepPlan({
		mode: 'dynamic-simulation', experimentId: 'fixture', experimentStateVersion: 1,
		baseExperimentPayload: '{}', seed: 'seed', parameterId: 'k', values: [1], source: 'morph', epsilon: 1,
		viewport: { width: 10, height: 10 }, anchor: { kind: 'initial-conditions', stepCount: 8 },
	})
	const sample = createPointCloudSnapshot({
		snapshotId: 'dynamic', experimentId: 'fixture', stateVersion: 1, simulationStep: 8, source: 'morph', formulaConfigurationHash: 'hash',
		points: { count: 1, capacity: 1, ids: new Uint32Array([1]), x: new Float64Array([1]), y: new Float64Array([1]) },
	})
	const result = await runParameterSweep(plan, async () => sample)
	assert.equal(result.samples[0]?.simulationStep, 8)
})
