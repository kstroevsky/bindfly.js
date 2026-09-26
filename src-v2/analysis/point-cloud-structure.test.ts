import assert from 'node:assert/strict'
import test from 'node:test'

import { createPointCloudSnapshot } from './point-cloud-snapshot.ts'
import { analyzePointCloudStructure } from './point-cloud-structure.ts'

const snapshot = createPointCloudSnapshot({
	snapshotId: 'fixture', experimentId: 'fixture', stateVersion: 1, simulationStep: 4, source: 'morph', formulaConfigurationHash: 'hash',
	points: {
		count: 4, capacity: 4, ids: new Uint32Array([0, 1, 2, 3]),
		x: new Float64Array([0, 1, 1, 0]), y: new Float64Array([0, 0, 1, 1]),
	},
})

test('point-cloud snapshots copy finite geometry and preserve provenance', () => {
	assert.equal(snapshot.metric, 'euclidean')
	assert.equal(snapshot.coordinateUnits, 'css-px')
	assert.equal(snapshot.simulationStep, 4)
	assert.deepEqual([...snapshot.ids], [0, 1, 2, 3])
})

test('structure analysis exposes beta0 and graph cycle rank separately', () => {
	const boundary = analyzePointCloudStructure(snapshot, 1.01)
	assert.equal(boundary.pointCount, 4)
	assert.equal(boundary.edgeCount, 4)
	assert.equal(boundary.beta0, 1)
	assert.equal(boundary.meanDegree, 2)
	assert.equal(boundary.isolatedPointCount, 0)
	assert.equal(boundary.graphCycleRank, 1)

	const complete = analyzePointCloudStructure(snapshot, 2)
	assert.equal(complete.edgeCount, 6)
	assert.equal(complete.graphCycleRank, 3)
})
