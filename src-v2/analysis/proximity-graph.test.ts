import assert from 'node:assert/strict'
import test from 'node:test'

import { analyzeProximityGraph } from './proximity-graph.ts'

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
