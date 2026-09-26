import assert from 'node:assert/strict'
import test from 'node:test'

import { createPointCloudSnapshot } from './point-cloud-snapshot.ts'
import { analyzeRipsComplex, rankBoundary2OverF2 } from './rips-complex.ts'

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

const budget = { maxMaterializedTriangles: 1000, maxTriangleCountForMaterialization: 10_000, maxHomologyTriangles: 1000 } as const

test('enumerates every Rips triangle once through adjacency intersections', () => {
	const result = analyzeRipsComplex(snapshot([[0, 0], [1, 0], [0, 1], [1, 1]]), 2, budget)
	assert.equal(result.edgeCount, 6)
	assert.equal(result.triangleCount, 4)
	assert.equal(result.triangles.count, 4)
	assert.deepEqual([...result.triangles.a], [0, 0, 0, 1])
	assert.deepEqual([...result.triangles.b], [1, 1, 2, 2])
	assert.deepEqual([...result.triangles.c], [2, 3, 3, 3])
	assert.equal(result.graphCycleRank, 3)
	assert.equal(result.beta1, 0)
})

test('materialization budget truncates visualization without changing the exact triangle count', () => {
	const result = analyzeRipsComplex(snapshot([[0, 0], [1, 0], [0, 1], [1, 1]]), 2, {
		maxMaterializedTriangles: 2,
		maxTriangleCountForMaterialization: 10,
		maxHomologyTriangles: 2,
	})
	assert.equal(result.triangleCount, 4)
	assert.equal(result.triangles.count, 2)
	assert.equal(result.triangles.truncated, true)
	assert.equal(result.beta1, undefined)
	assert.equal(result.beta1Status, 'budget-exceeded')
	assert.match(result.warnings.join(' '), /2-of-4 LOD sample/)
})

test('visualization ceiling refuses huge triangle materialization while keeping exact counts', () => {
	const result = analyzeRipsComplex(snapshot([[0, 0], [1, 0], [0, 1], [1, 1]]), 2, {
		maxMaterializedTriangles: 4,
		maxTriangleCountForMaterialization: 3,
		maxHomologyTriangles: 0,
	})
	assert.equal(result.triangleCount, 4)
	assert.equal(result.triangles.count, 0)
	assert.match(result.warnings.join(' '), /visualization omitted/i)
})

test('F2 boundary rank matches GUDHI fixtures for a triangle boundary and filled triangle', () => {
	const sources = new Uint32Array([0, 0, 1])
	const targets = new Uint32Array([1, 2, 2])
	const emptyTriangles = { count: 0, a: new Uint32Array(0), b: new Uint32Array(0), c: new Uint32Array(0) }
	assert.equal(rankBoundary2OverF2(3, 3, sources, targets, emptyTriangles), 0)
	assert.equal(rankBoundary2OverF2(3, 3, sources, targets, {
		count: 1,
		a: new Uint32Array([0]),
		b: new Uint32Array([1]),
		c: new Uint32Array([2]),
	}), 1)
})

test('square graph has one graph cycle and one H1 class until a diagonal fills it', () => {
	const square = snapshot([[0, 0], [1, 0], [1, 1], [0, 1]])
	const boundary = analyzeRipsComplex(square, 1.01, budget)
	assert.equal(boundary.edgeCount, 4)
	assert.equal(boundary.triangleCount, 0)
	assert.equal(boundary.graphCycleRank, 1)
	assert.equal(boundary.beta1, 1)
	const filled = analyzeRipsComplex(square, 1.5, budget)
	assert.equal(filled.edgeCount, 6)
	assert.equal(filled.triangleCount, 4)
	assert.equal(filled.beta1, 0)
})

test('static H0/H1 matches GUDHI point-cloud fixtures', () => {
	const onePoint = analyzeRipsComplex(snapshot([[0, 0]]), 1, budget)
	assert.equal(onePoint.beta0, 1)
	assert.equal(onePoint.beta1, 0)

	const twoPoints = analyzeRipsComplex(snapshot([[0, 0], [2, 0]]), 3, budget)
	assert.equal(twoPoints.beta0, 1)
	assert.equal(twoPoints.beta1, 0)

	const filledTriangle = analyzeRipsComplex(snapshot([[0, 0], [1, 0], [0.5, Math.sqrt(3) / 2]]), 1.01, budget)
	assert.equal(filledTriangle.beta0, 1)
	assert.equal(filledTriangle.graphCycleRank, 1)
	assert.equal(filledTriangle.triangleCount, 1)
	assert.equal(filledTriangle.beta1, 0)

	const circle = Array.from({ length: 8 }, (_, index) => {
		const angle = 2 * Math.PI * index / 8
		return [Math.cos(angle), Math.sin(angle)] as const
	})
	const circleResult = analyzeRipsComplex(snapshot(circle), 0.8, budget)
	assert.equal(circleResult.beta0, 1)
	assert.equal(circleResult.beta1, 1)

	const figureEight = snapshot([
		[-1, 0], [-0.5, 0.5], [0, 0], [-0.5, -0.5],
		[0.5, 0.5], [1, 0], [0.5, -0.5],
	])
	const figureEightResult = analyzeRipsComplex(figureEight, 0.8, budget)
	assert.equal(figureEightResult.beta0, 1)
	assert.equal(figureEightResult.beta1, 2)
})

test('Rips edges and triangles retain their filtration birth values', () => {
	const result = analyzeRipsComplex(snapshot([[0, 0], [1, 0], [1, 1], [0, 1]]), 2, budget)
	assert.deepEqual([...result.edgeBirths].sort((left, right) => left - right), [1, 1, 1, 1, Math.sqrt(2), Math.sqrt(2)])
	assert.equal(result.triangles.births.length, 4)
	for (const birth of result.triangles.births) assert.ok(Math.abs(birth - Math.sqrt(2)) < 1e-12)
})
