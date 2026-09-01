import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeProximityGraph, createProximityGraphWorkspace } from './proximity-graph.ts'

const points = [
	{ id: 1, x: 0, y: 0 },
	{ id: 2, x: 3, y: 0 },
	{ id: 3, x: 20, y: 0 },
]

test('builds unique undirected edges and connected components', () => {
	const result = analyzeProximityGraph({ points, connectionRadius: 5 })

	assert.deepEqual(result.edges.map(({ sourceId, targetId }) => [sourceId, targetId]), [[1, 2]])
	assert.deepEqual(result.components, [[1, 2], [3]])
	assert.deepEqual(result.degrees, [
		{ id: 1, degree: 1 },
		{ id: 2, degree: 1 },
		{ id: 3, degree: 0 },
	])
})

test('increasing radius on the same points cannot increase components', () => {
	const narrow = analyzeProximityGraph({ points, connectionRadius: 5 })
	const wide = analyzeProximityGraph({ points, connectionRadius: 25 })

	assert.ok(wide.components.length <= narrow.components.length)
	assert.equal(wide.edges.length, 3)
	assert.equal(new Set(wide.edges.map(({ sourceId, targetId }) => `${sourceId}:${targetId}`)).size, 3)
})

test('rejects non-positive connection radius', () => {
	assert.throws(
		() => analyzeProximityGraph({ points, connectionRadius: 0 }),
		/positive finite/,
	)
})

test('reusable typed workspace matches the object oracle without replacing buffers', () => {
	const workspace = createProximityGraphWorkspace(8)
	const pointBuffer = {
		count: points.length,
		capacity: points.length,
		ids: new Uint32Array(points.map(({ id }) => id)),
		x: new Float64Array(points.map(({ x }) => x)),
		y: new Float64Array(points.map(({ y }) => y)),
	}
	const first = workspace.analyze(pointBuffer, 5)
	const identities = [first.sourceIndices, first.targetIndices, first.distances, first.opacities, first.degrees]
	const second = workspace.analyze(pointBuffer, 25)

	assert.equal(first, second)
	assert.deepEqual(
		[second.sourceIndices, second.targetIndices, second.distances, second.opacities, second.degrees],
		identities,
	)
	assert.equal(second.edgeCount, 3)
	assert.equal(second.componentCount, 1)
	assert.deepEqual([...second.sourceIndices.subarray(0, second.edgeCount)], [0, 0, 1])
	assert.deepEqual([...second.targetIndices.subarray(0, second.edgeCount)], [1, 2, 2])
})
