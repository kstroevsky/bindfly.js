import assert from 'node:assert/strict'
import test from 'node:test'

import type { PointBuffer2D } from '../core/index.ts'
import { createProximityGraphWorkspace } from './proximity-graph.ts'
import { createUniformGridProximityGraphWorkspace, shouldUseUniformGrid } from './uniform-grid-proximity-graph.ts'

const compare = (points: PointBuffer2D, radius: number) => {
	const brute = createProximityGraphWorkspace(points.capacity).analyze(points, radius)
	const grid = createUniformGridProximityGraphWorkspace(points.capacity).analyze(points, radius)
	assert.equal(grid.edgeCount, brute.edgeCount)
	assert.equal(grid.componentCount, brute.componentCount)
	assert.deepEqual([...grid.sourceIndices.subarray(0, grid.edgeCount)], [...brute.sourceIndices.subarray(0, brute.edgeCount)])
	assert.deepEqual([...grid.targetIndices.subarray(0, grid.edgeCount)], [...brute.targetIndices.subarray(0, brute.edgeCount)])
	assert.deepEqual([...grid.distances.subarray(0, grid.edgeCount)], [...brute.distances.subarray(0, brute.edgeCount)])
	assert.deepEqual([...grid.opacities.subarray(0, grid.edgeCount)], [...brute.opacities.subarray(0, brute.edgeCount)])
	assert.deepEqual([...grid.degrees.subarray(0, points.count)], [...brute.degrees.subarray(0, points.count)])
}

test('matches brute force at cell boundaries and negative coordinates', () => {
	const coordinates = [-20, -10, -0.001, 0, 9.999, 10, 20]
	const count = coordinates.length
	const points = {
		count,
		capacity: count,
		ids: new Uint32Array(coordinates.map((_, index) => index)),
		x: new Float64Array(coordinates),
		y: new Float64Array(coordinates.map((value, index) => index % 2 === 0 ? value : -value)),
	}
	for (const radius of [0.001, 10, 20, 100]) compare(points, radius)
})

test('matches brute force across deterministic randomized clouds and radii', () => {
	let randomState = 0x12345678
	const next = () => {
		randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0
		return randomState / 0x100000000
	}

	for (let fixture = 0; fixture < 40; fixture++) {
		const count = 1 + Math.floor(next() * 80)
		const points = {
			count,
			capacity: count,
			ids: new Uint32Array(count),
			x: new Float64Array(count),
			y: new Float64Array(count),
		}
		for (let index = 0; index < count; index++) {
			points.ids[index] = fixture * 1000 + index
			points.x[index] = next() * 1000 - 200
			points.y[index] = next() * 800 - 100
		}
		for (const radius of [1, 25, 100, 250, 2000]) compare(points, radius)
	}
})

test('reuses every result and grid buffer across analyses', () => {
	const workspace = createUniformGridProximityGraphWorkspace(16)
	const points = {
		count: 3,
		capacity: 3,
		ids: new Uint32Array([1, 2, 3]),
		x: new Float64Array([0, 3, 20]),
		y: new Float64Array([0, 0, 0]),
	}
	const first = workspace.analyze(points, 5)
	const identities = [first.sourceIndices, first.targetIndices, first.distances, first.opacities, first.degrees]
	const second = workspace.analyze(points, 25)
	assert.equal(first, second)
	assert.deepEqual([second.sourceIndices, second.targetIndices, second.distances, second.opacities, second.degrees], identities)
})

test('selects grid only for sufficiently sparse neighborhoods', () => {
	const points = {
		count: 100,
		capacity: 100,
		ids: new Uint32Array(100),
		x: new Float64Array(Array.from({ length: 100 }, (_, index) => index % 10 * 120)),
		y: new Float64Array(Array.from({ length: 100 }, (_, index) => Math.floor(index / 10) * 70)),
	}
	assert.equal(shouldUseUniformGrid(points, 50), true)
	assert.equal(shouldUseUniformGrid(points, 250), false)
})
