import assert from 'node:assert/strict'
import test from 'node:test'

import { createPointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import { analyzeRipsComplex, DEFAULT_RIPS_ANALYSIS_BUDGET } from '../../../src-v2/analysis/rips-complex.ts'
import { createStudioPerformanceSnapshot, estimateAnalysisBufferBytes } from './studio-performance.ts'

test('performance snapshot reports local runtime timing and explicit typed analysis memory', () => {
	const snapshot = createPointCloudSnapshot({
		snapshotId: 'performance', experimentId: 'fixture', stateVersion: 1, simulationStep: 2,
		source: 'morph', formulaConfigurationHash: 'hash',
		points: { count: 2, capacity: 2, ids: new Uint32Array([1, 2]), x: new Float64Array([0, 1]), y: new Float64Array([0, 0]) },
	})
	const analysis = analyzeRipsComplex(snapshot, 2, DEFAULT_RIPS_ANALYSIS_BUDGET)
	const bytes = estimateAnalysisBufferBytes(snapshot, analysis)
	assert.ok(bytes && bytes > snapshot.ids.byteLength + snapshot.x.byteLength + snapshot.y.byteLength)
	const performance = createStudioPerformanceSnapshot({
		telemetry: { points: 2, edges: 1, components: 1, step: 2, frameMs: 10, simulationMs: 2, renderMs: 3, droppedSteps: 0, searchBackend: 'brute' },
		renderer: 'canvas2d', runtime: 'main', dpr: 2, analysisMs: 4, analysisSnapshot: snapshot, analysisResult: analysis,
	})
	assert.equal(performance.fps, 100)
	assert.equal(performance.analysisBufferBytes, bytes)
	assert.equal(performance.analysisMs, 4)
})
