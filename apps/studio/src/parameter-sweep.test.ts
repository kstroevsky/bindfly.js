import assert from 'node:assert/strict'
import test from 'node:test'

import { createPointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import { analyzeRipsComplex, DEFAULT_RIPS_ANALYSIS_BUDGET } from '../../../src-v2/analysis/rips-complex.ts'
import { defineParameterSchema } from '../../../src-v2/core/parameters.ts'
import {
	createParameterSweepStateFingerprint,
	createParameterSweepPlan,
	createSweepValues,
	getSweepableFormulaParameters,
	runParameterSweep,
} from './parameter-sweep.ts'

const schema = defineParameterSchema({
	k: { kind: 'number', default: 1, min: 0, max: 2, step: 0.5, semantic: 'formula-parameter', invalidation: 'hot-update' },
	radius: { kind: 'number', default: 10, min: 1, max: 100, step: 1, invalidation: 'hot-update' },
})

const analyze = async (snapshot: ReturnType<typeof createPointCloudSnapshot>, epsilon: number) =>
	analyzeRipsComplex(snapshot, epsilon, DEFAULT_RIPS_ANALYSIS_BUDGET)

test('parameter sweep values are restricted to declared formula parameters and bounded samples', () => {
	assert.deepEqual(getSweepableFormulaParameters(schema).map(({ id }) => id), ['k'])
	assert.deepEqual(createSweepValues(schema.k, { start: 0, end: 2, step: 0.5 }), [0, 0.5, 1, 1.5, 2])
	assert.throws(() => createSweepValues(schema.radius, { start: 1, end: 2, step: 1 }), /declared formula parameter/)
	assert.throws(() => createSweepValues(schema.k, { start: 0, end: 2, step: 0.1 }), /declared parameter step/)
	assert.throws(() => createSweepValues(schema.k, { start: 0, end: 2, step: 0.5 }, 4), /sample product budget/)
})

test('frozen sweep rejects samples from a different simulation step and records analyzer provenance', async () => {
	const baseline = createPointCloudSnapshot({
		snapshotId: 'baseline', experimentId: 'fixture', stateVersion: 1, simulationStep: 4, source: 'morph',
		formulaConfigurationHash: 'hash-baseline',
		points: { count: 2, capacity: 2, ids: new Uint32Array([1, 2]), x: new Float64Array([0, 1]), y: new Float64Array([0, 0]) },
	})
	const plan = createParameterSweepPlan({
		mode: 'frozen-formula', experimentId: 'fixture', experimentStateVersion: 1,
		baseExperimentPayload: '{"fixture":true}', seed: 'seed', parameterId: 'k', values: [0, 1], source: 'morph', epsilon: 2,
		viewport: { width: 100, height: 100 },
		anchor: {
			kind: 'frozen-simulation', simulationSnapshotId: 'frozen-1', simulationStep: 4,
			stateFingerprint: await createParameterSweepStateFingerprint(baseline),
		},
	})
	const snapshot = (step: number, value: number) => createPointCloudSnapshot({
		snapshotId: `snapshot-${value}`, experimentId: 'fixture', stateVersion: 1, simulationStep: step, source: 'morph',
		formulaConfigurationHash: `hash-${value}`,
		points: { count: 2, capacity: 2, ids: new Uint32Array([1, 2]), x: new Float64Array([0, value + 1]), y: new Float64Array([0, 0]) },
	})
	const result = await runParameterSweep(plan, async (value) => snapshot(4, value), analyze)
	assert.equal(result.analyzer.approximation, 'full-point-cloud')
	assert.equal(result.samples.length, 2)
	assert.equal(result.samples[0]?.beta0, 1)
	await assert.rejects(runParameterSweep(plan, async (value, index) => snapshot(index === 0 ? 4 : 5, value), analyze), /changed the simulation step/)
})

test('dynamic sweep requires every sample to run the same declared step count', async () => {
	const plan = createParameterSweepPlan({
		mode: 'dynamic-simulation', experimentId: 'fixture', experimentStateVersion: 1,
		baseExperimentPayload: '{}', seed: 'seed', parameterId: 'k', values: [1], source: 'morph', epsilon: 1,
		viewport: { width: 10, height: 10 },
		anchor: { kind: 'initial-conditions', stepCount: 8, fixedStepSeconds: 1 / 120, deterministicTier: 'same-build-cpu' },
	})
	const sample = createPointCloudSnapshot({
		snapshotId: 'dynamic', experimentId: 'fixture', stateVersion: 1, simulationStep: 8, source: 'morph', formulaConfigurationHash: 'hash',
		points: { count: 1, capacity: 1, ids: new Uint32Array([1]), x: new Float64Array([1]), y: new Float64Array([1]) },
	})
	const result = await runParameterSweep(plan, async () => sample, analyze)
	assert.equal(result.samples[0]?.simulationStep, 8)
})

test('sweep mode and anchor kind are a versioned invariant', async () => {
	const snapshot = createPointCloudSnapshot({
		snapshotId: 'anchor', experimentId: 'fixture', stateVersion: 1, simulationStep: 0, source: 'morph', formulaConfigurationHash: 'hash',
		points: { count: 1, capacity: 1, ids: new Uint32Array([1]), x: new Float64Array([0]), y: new Float64Array([0]) },
	})
	const fingerprint = await createParameterSweepStateFingerprint(snapshot)
	const common = {
		experimentId: 'fixture', experimentStateVersion: 1, baseExperimentPayload: '{}', seed: 'seed', parameterId: 'k',
		values: [1], source: 'morph' as const, epsilon: 1, viewport: { width: 10, height: 10 },
	}
	assert.throws(() => createParameterSweepPlan({
		...common, mode: 'frozen-formula',
		anchor: { kind: 'initial-conditions', stepCount: 1, fixedStepSeconds: 1 / 60, deterministicTier: 'same-build-cpu' },
	}), /does not match anchor/)
	assert.throws(() => createParameterSweepPlan({
		...common, mode: 'dynamic-simulation',
		anchor: { kind: 'frozen-simulation', simulationSnapshotId: 'frozen', simulationStep: 0, stateFingerprint: fingerprint },
	}), /does not match anchor/)
})

test('frozen-state fingerprint ignores ephemeral snapshot IDs but changes with captured state', async () => {
	const snapshot = (snapshotId: string, x: number) => createPointCloudSnapshot({
		snapshotId, experimentId: 'fixture', stateVersion: 1, simulationStep: 4, source: 'morph', formulaConfigurationHash: 'hash',
		points: { count: 1, capacity: 1, ids: new Uint32Array([7]), x: new Float64Array([x]), y: new Float64Array([2]) },
	})
	const first = await createParameterSweepStateFingerprint(snapshot('one', 1))
	const sameState = await createParameterSweepStateFingerprint(snapshot('two', 1))
	const changedState = await createParameterSweepStateFingerprint(snapshot('three', 3))
	assert.deepEqual(first, sameState)
	assert.notDeepEqual(first, changedState)
})

test('running the same sweep plan twice produces identical validated metrics', async () => {
	const plan = createParameterSweepPlan({
		mode: 'dynamic-simulation', experimentId: 'fixture', experimentStateVersion: 1,
		baseExperimentPayload: '{}', seed: 'seed', parameterId: 'k', values: [0.5, 1], source: 'morph', epsilon: 1.5,
		viewport: { width: 10, height: 10 },
		anchor: { kind: 'initial-conditions', stepCount: 8, fixedStepSeconds: 1 / 120, deterministicTier: 'same-build-cpu' },
	})
	const evaluate = async (value: number) => createPointCloudSnapshot({
		snapshotId: `dynamic-${value}`, experimentId: 'fixture', stateVersion: 1, simulationStep: 8, source: 'morph',
		formulaConfigurationHash: `hash-${value}`,
		points: { count: 2, capacity: 2, ids: new Uint32Array([1, 2]), x: new Float64Array([0, value]), y: new Float64Array([0, 0]) },
	})
	const first = await runParameterSweep(plan, evaluate, analyze)
	const second = await runParameterSweep(plan, evaluate, analyze)
	assert.deepEqual(first, second)
})

test('running the same frozen-state sweep twice produces identical validated metrics', async () => {
	const baseline = createPointCloudSnapshot({
		snapshotId: 'frozen-baseline', experimentId: 'fixture', stateVersion: 1, simulationStep: 12, source: 'morph',
		formulaConfigurationHash: 'baseline-hash',
		points: { count: 2, capacity: 2, ids: new Uint32Array([1, 2]), x: new Float64Array([0, 2]), y: new Float64Array([0, 0]) },
	})
	const plan = createParameterSweepPlan({
		mode: 'frozen-formula', experimentId: 'fixture', experimentStateVersion: 1,
		baseExperimentPayload: '{}', seed: 'seed', parameterId: 'k', values: [0.5, 1], source: 'morph', epsilon: 1.5,
		viewport: { width: 10, height: 10 },
		anchor: {
			kind: 'frozen-simulation', simulationSnapshotId: 'frozen-12', simulationStep: 12,
			stateFingerprint: await createParameterSweepStateFingerprint(baseline),
		},
	})
	const evaluate = async (value: number) => createPointCloudSnapshot({
		snapshotId: `frozen-${value}`, experimentId: 'fixture', stateVersion: 1, simulationStep: 12, source: 'morph',
		formulaConfigurationHash: `hash-${value}`,
		points: { count: 2, capacity: 2, ids: new Uint32Array([1, 2]), x: new Float64Array([0, value]), y: new Float64Array([0, 0]) },
	})
	const first = await runParameterSweep(plan, evaluate, analyze)
	const second = await runParameterSweep(plan, evaluate, analyze)
	assert.deepEqual(first, second)
})
