import assert from 'node:assert/strict'
import test from 'node:test'

import { createPointCloudSnapshot } from './point-cloud-snapshot.ts'
import {
	countPersistenceIntervalsAt,
	createBudgetExceededPersistenceResult,
	preflightRipsPersistence,
} from './rips-persistence.ts'

const snapshot = (coordinates: readonly (readonly [number, number])[]) => createPointCloudSnapshot({
	snapshotId: 'fixture', experimentId: 'fixture', stateVersion: 1, simulationStep: 0,
	source: 'morph', formulaConfigurationHash: 'fixture',
	points: {
		count: coordinates.length,
		capacity: coordinates.length,
		ids: Uint32Array.from(coordinates, (_, index) => index),
		x: Float64Array.from(coordinates, ([x]) => x),
		y: Float64Array.from(coordinates, ([, y]) => y),
	},
})

const backend = { id: 'fixture', version: '1', sourceCommit: 'fixture', license: 'MIT' } as const

test('persistence cursor counts precomputed half-open intervals without recomputation', () => {
	const h0 = [{ birth: 0, death: 2 }, { birth: 0, death: null }] as const
	assert.equal(countPersistenceIntervalsAt(h0, 1.999), 2)
	assert.equal(countPersistenceIntervalsAt(h0, 2), 1)
	assert.equal(countPersistenceIntervalsAt([{ birth: 1, death: Math.sqrt(2) }], 1.1), 1)
	assert.equal(countPersistenceIntervalsAt([{ birth: 1, death: Math.sqrt(2) }], Math.sqrt(2)), 0)
})

test('persistence preflight records the exact filtration size before invoking a backend', () => {
	const result = preflightRipsPersistence(snapshot([[0, 0], [1, 0], [1, 1], [0, 1]]), 2)
	assert.equal(result.status, 'ready')
	assert.equal(result.pointCount, 4)
	assert.equal(result.edgeCount, 6)
	assert.equal(result.triangleCount, 4)
	assert.equal(result.simplexCount, 14)
})

test('persistence preflight refuses work outside triangle and simplex budgets', () => {
	const square = snapshot([[0, 0], [1, 0], [1, 1], [0, 1]])
	const triangleLimited = preflightRipsPersistence(square, 2, { maxTriangles: 3, maxSimplices: 100 })
	assert.equal(triangleLimited.status, 'budget-exceeded')
	assert.match(triangleLimited.warnings.join(' '), /triangles exceed the budget/i)
	const refusal = createBudgetExceededPersistenceResult(triangleLimited, backend)
	assert.deepEqual(refusal.h0, [])
	assert.deepEqual(refusal.h1, [])
	assert.deepEqual(refusal.backend, backend)

	const simplexLimited = preflightRipsPersistence(square, 2, { maxTriangles: 10, maxSimplices: 10 })
	assert.equal(simplexLimited.status, 'budget-exceeded')
	assert.match(simplexLimited.warnings.join(' '), /simplices exceed the budget/i)
})
