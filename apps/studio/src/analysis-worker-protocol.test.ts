import assert from 'node:assert/strict'
import test from 'node:test'

import { createPointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import { isAnalysisWorkerRequest, isAnalysisWorkerResponse } from './analysis-worker-protocol.ts'

const snapshot = createPointCloudSnapshot({
	snapshotId: 'fixture', experimentId: 'fixture-experiment', stateVersion: 1, simulationStep: 2,
	source: 'morph', formulaConfigurationHash: 'fixture-hash',
	points: {
		count: 2, capacity: 2, ids: new Uint32Array([0, 1]),
		x: new Float64Array([0, 3]), y: new Float64Array([0, 4]),
	},
})

test('analysis worker protocol validates pinned snapshot requests and structure results', () => {
	assert.equal(isAnalysisWorkerRequest({ type: 'analyze-rips', requestId: 'r1', snapshot, epsilon: 5 }), true)
	assert.equal(isAnalysisWorkerRequest({ type: 'analyze-rips', requestId: 'r1', snapshot, epsilon: 0 }), false)
	assert.equal(isAnalysisWorkerRequest({ type: 'analyze-rips-persistence', requestId: 'p1', snapshot, epsilonMax: 1000 }), true)
	assert.equal(isAnalysisWorkerRequest({ type: 'analyze-rips-persistence', requestId: 'p1', snapshot, epsilonMax: 0 }), false)
	assert.equal(isAnalysisWorkerResponse({
		type: 'rips-result', requestId: 'r1',
		result: {
			pointCount: 2, edgeCount: 1, beta0: 1, meanDegree: 1,
			isolatedPointCount: 0, graphCycleRank: 0, triangleCount: 0,
			triangles: { count: 0, totalCount: 0, truncated: false, a: new Uint32Array(0), b: new Uint32Array(0), c: new Uint32Array(0), births: new Float64Array(0) },
			beta1: 0, beta1Status: 'computed', epsilon: 5, metric: 'euclidean',
			edgeSourceIndices: new Uint32Array([0]), edgeTargetIndices: new Uint32Array([1]), edgeBirths: new Float64Array([5]), warnings: [],
		},
	}), true)
	assert.equal(isAnalysisWorkerResponse({
		type: 'persistence-result', requestId: 'p1',
		result: {
			status: 'computed', epsilonMax: 1000, metric: 'euclidean',
			pointCount: 2, edgeCount: 1, triangleCount: 0, triangleCountExact: true,
			simplexCount: 3, simplexCountExact: true,
			h0: [{ birth: 0, death: 5 }, { birth: 0, death: null }], h1: [], warnings: [],
			backend: { id: 'ripser-wasm', version: '1', sourceCommit: 'fixture', license: 'MIT', numericSemantics: 'Full H₀/H₁ over F₂ · Ripser float filtration' },
		},
	}), true)
	assert.equal(isAnalysisWorkerResponse({ type: 'analysis-error', requestId: 'r1', message: 'failed' }), true)
})
