import type { PointBuffer2D } from '../core/index.ts'
import type { PointCloudSnapshot } from './point-cloud-snapshot.ts'
import { createProximityGraphWorkspace } from './proximity-graph.ts'

export const RIPS_COMPLEX_ANALYZER_ID = 'rips-complex-2d'
export const RIPS_COMPLEX_ANALYZER_VERSION = '1'

export interface RipsAnalysisBudget {
	readonly maxMaterializedTriangles: number
	readonly maxTriangleCountForMaterialization: number
	readonly maxHomologyTriangles: number
}

export const DEFAULT_RIPS_ANALYSIS_BUDGET: RipsAnalysisBudget = Object.freeze({
	maxMaterializedTriangles: 50_000,
	maxTriangleCountForMaterialization: 500_000,
	maxHomologyTriangles: 50_000,
})

export interface RipsTriangleBuffer {
	readonly count: number
	readonly totalCount: number
	readonly truncated: boolean
	readonly a: Uint32Array
	readonly b: Uint32Array
	readonly c: Uint32Array
	readonly births: Float64Array
}

export interface RipsComplexResult {
	readonly pointCount: number
	readonly edgeCount: number
	readonly beta0: number
	readonly meanDegree: number
	readonly isolatedPointCount: number
	readonly graphCycleRank: number
	readonly triangleCount: number
	readonly triangles: RipsTriangleBuffer
	readonly beta1?: number
	readonly beta1Status: 'computed' | 'budget-exceeded'
	readonly epsilon: number
	readonly metric: 'euclidean'
	readonly edgeSourceIndices: Uint32Array
	readonly edgeTargetIndices: Uint32Array
	readonly edgeBirths: Float64Array
	readonly warnings: readonly string[]
}

export interface RipsComplexSizeMeasurement {
	readonly pointCount: number
	readonly edgeCount: number
	/** Exact when `triangleCountExact` is true; otherwise a proven lower bound. */
	readonly triangleCount: number
	readonly triangleCountExact: boolean
}

interface Adjacency {
	readonly offsets: Uint32Array
	readonly neighbors: Uint32Array
}

const validateBudget = (budget: RipsAnalysisBudget): void => {
	if (!Number.isInteger(budget.maxMaterializedTriangles) || budget.maxMaterializedTriangles < 0) {
		throw new RangeError('Rips materialized-triangle budget must be a non-negative integer.')
	}
	if (!Number.isInteger(budget.maxTriangleCountForMaterialization) || budget.maxTriangleCountForMaterialization < 0) {
		throw new RangeError('Rips triangle-visualization ceiling must be a non-negative integer.')
	}
	if (!Number.isInteger(budget.maxHomologyTriangles) || budget.maxHomologyTriangles < 0) {
		throw new RangeError('Rips homology-triangle budget must be a non-negative integer.')
	}
}

const createAdjacency = (
	pointCount: number,
	edgeCount: number,
	sourceIndices: Uint32Array,
	targetIndices: Uint32Array,
	degrees: Uint32Array,
): Adjacency => {
	const offsets = new Uint32Array(pointCount + 1)
	for (let index = 0; index < pointCount; index++) offsets[index + 1] = (offsets[index] ?? 0) + (degrees[index] ?? 0)
	const neighbors = new Uint32Array(offsets[pointCount] ?? 0)
	const cursors = offsets.slice(0, pointCount)
	for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex++) {
		const source = sourceIndices[edgeIndex]
		const target = targetIndices[edgeIndex]
		if (source === undefined || target === undefined) continue
		neighbors[cursors[source] ?? 0] = target
		cursors[source] = (cursors[source] ?? 0) + 1
		neighbors[cursors[target] ?? 0] = source
		cursors[target] = (cursors[target] ?? 0) + 1
	}
	for (let vertex = 0; vertex < pointCount; vertex++) {
		neighbors.subarray(offsets[vertex] ?? 0, offsets[vertex + 1] ?? 0).sort()
	}
	return { offsets, neighbors }
}

const forEachTriangle = (
	edgeCount: number,
	sourceIndices: Uint32Array,
	targetIndices: Uint32Array,
	adjacency: Adjacency,
	visit: (a: number, b: number, c: number, triangleIndex: number) => void,
	maximumCount = Number.POSITIVE_INFINITY,
): number => {
	let triangleIndex = 0
	for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex++) {
		if (triangleIndex >= maximumCount) break
		const a = sourceIndices[edgeIndex]
		const b = targetIndices[edgeIndex]
		if (a === undefined || b === undefined) continue
		let left = adjacency.offsets[a] ?? 0
		let right = adjacency.offsets[b] ?? 0
		const leftEnd = adjacency.offsets[a + 1] ?? left
		const rightEnd = adjacency.offsets[b + 1] ?? right
		while (left < leftEnd && (adjacency.neighbors[left] ?? 0) <= b) left++
		while (right < rightEnd && (adjacency.neighbors[right] ?? 0) <= b) right++
		while (left < leftEnd && right < rightEnd) {
			if (triangleIndex >= maximumCount) break
			const leftVertex = adjacency.neighbors[left]
			const rightVertex = adjacency.neighbors[right]
			if (leftVertex === undefined || rightVertex === undefined) break
			if (leftVertex === rightVertex) {
				visit(a, b, leftVertex, triangleIndex++)
				left++
				right++
			} else if (leftVertex < rightVertex) left++
			else right++
		}
	}
	return triangleIndex
}

export const measureRipsComplexSize = (
	snapshot: PointCloudSnapshot,
	epsilon: number,
	triangleCountLimit = Number.POSITIVE_INFINITY,
): RipsComplexSizeMeasurement => {
	if (!Number.isFinite(epsilon) || epsilon <= 0) throw new RangeError('Rips epsilon must be a positive finite number.')
	if (triangleCountLimit !== Number.POSITIVE_INFINITY
		&& (!Number.isInteger(triangleCountLimit) || triangleCountLimit <= 0)) {
		throw new RangeError('Rips triangle count limit must be a positive integer or Infinity.')
	}
	const pointCount = snapshot.ids.length
	if (pointCount === 0) return { pointCount: 0, edgeCount: 0, triangleCount: 0, triangleCountExact: true }
	const points: PointBuffer2D = { count: pointCount, capacity: pointCount, ids: snapshot.ids, x: snapshot.x, y: snapshot.y }
	const graph = createProximityGraphWorkspace(pointCount).analyze(points, epsilon)
	const adjacency = createAdjacency(pointCount, graph.edgeCount, graph.sourceIndices, graph.targetIndices, graph.degrees)
	const triangleCount = forEachTriangle(
		graph.edgeCount,
		graph.sourceIndices,
		graph.targetIndices,
		adjacency,
		() => {},
		triangleCountLimit,
	)
	return {
		pointCount,
		edgeCount: graph.edgeCount,
		triangleCount,
		triangleCountExact: triangleCountLimit === Number.POSITIVE_INFINITY || triangleCount < triangleCountLimit,
	}
}

const symmetricDifference = (left: readonly number[], right: readonly number[]): number[] => {
	const result: number[] = []
	let leftIndex = 0
	let rightIndex = 0
	while (leftIndex < left.length || rightIndex < right.length) {
		const leftValue = left[leftIndex]
		const rightValue = right[rightIndex]
		if (rightValue === undefined || (leftValue !== undefined && leftValue < rightValue)) {
			result.push(leftValue as number)
			leftIndex++
		} else if (leftValue === undefined || rightValue < leftValue) {
			result.push(rightValue)
			rightIndex++
		} else {
			leftIndex++
			rightIndex++
		}
	}
	return result
}

export const rankBoundary2OverF2 = (
	pointCount: number,
	edgeCount: number,
	sourceIndices: Uint32Array,
	targetIndices: Uint32Array,
	triangles: Pick<RipsTriangleBuffer, 'count' | 'a' | 'b' | 'c'>,
): number => {
	const edgeLookup = new Int32Array(pointCount * pointCount)
	edgeLookup.fill(-1)
	for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex++) {
		const source = sourceIndices[edgeIndex]
		const target = targetIndices[edgeIndex]
		if (source === undefined || target === undefined) continue
		edgeLookup[source * pointCount + target] = edgeIndex
		edgeLookup[target * pointCount + source] = edgeIndex
	}
	const pivots = new Map<number, number[]>()
	let rank = 0
	for (let triangleIndex = 0; triangleIndex < triangles.count; triangleIndex++) {
		const a = triangles.a[triangleIndex]
		const b = triangles.b[triangleIndex]
		const c = triangles.c[triangleIndex]
		if (a === undefined || b === undefined || c === undefined) continue
		const ab = edgeLookup[a * pointCount + b]
		const ac = edgeLookup[a * pointCount + c]
		const bc = edgeLookup[b * pointCount + c]
		if (ab === undefined || ac === undefined || bc === undefined || ab < 0 || ac < 0 || bc < 0) {
			throw new Error('Rips triangle references an edge outside the 1-skeleton.')
		}
		let column = [ab, ac, bc].sort((left, right) => left - right)
		while (column.length > 0) {
			const pivot = column[column.length - 1] as number
			const existing = pivots.get(pivot)
			if (!existing) {
				pivots.set(pivot, column)
				rank++
				break
			}
			column = symmetricDifference(column, existing)
		}
	}
	return rank
}

export const analyzeRipsComplex = (
	snapshot: PointCloudSnapshot,
	epsilon: number,
	budget: RipsAnalysisBudget,
): RipsComplexResult => {
	if (!Number.isFinite(epsilon) || epsilon <= 0) throw new RangeError('Rips epsilon must be a positive finite number.')
	validateBudget(budget)
	const pointCount = snapshot.ids.length
	if (pointCount === 0) {
		return {
			pointCount: 0, edgeCount: 0, beta0: 0, meanDegree: 0, isolatedPointCount: 0, graphCycleRank: 0,
			triangleCount: 0,
			triangles: { count: 0, totalCount: 0, truncated: false, a: new Uint32Array(0), b: new Uint32Array(0), c: new Uint32Array(0), births: new Float64Array(0) },
			beta1: 0, beta1Status: 'computed', epsilon, metric: 'euclidean',
			edgeSourceIndices: new Uint32Array(0), edgeTargetIndices: new Uint32Array(0), edgeBirths: new Float64Array(0), warnings: [],
		}
	}
	const points: PointBuffer2D = { count: pointCount, capacity: pointCount, ids: snapshot.ids, x: snapshot.x, y: snapshot.y }
	const graph = createProximityGraphWorkspace(pointCount).analyze(points, epsilon)
	let isolatedPointCount = 0
	for (let index = 0; index < pointCount; index++) if ((graph.degrees[index] ?? 0) === 0) isolatedPointCount++
	const edgeSourceIndices = graph.sourceIndices.slice(0, graph.edgeCount)
	const edgeTargetIndices = graph.targetIndices.slice(0, graph.edgeCount)
	const edgeBirths = graph.distances.slice(0, graph.edgeCount)
	const adjacency = createAdjacency(pointCount, graph.edgeCount, graph.sourceIndices, graph.targetIndices, graph.degrees)
	const triangleCount = forEachTriangle(graph.edgeCount, graph.sourceIndices, graph.targetIndices, adjacency, () => {})
	const materializedCount = triangleCount > budget.maxTriangleCountForMaterialization
		? 0
		: Math.min(triangleCount, budget.maxMaterializedTriangles)
	const triangleA = new Uint32Array(materializedCount)
	const triangleB = new Uint32Array(materializedCount)
	const triangleC = new Uint32Array(materializedCount)
	const triangleBirths = new Float64Array(materializedCount)
	const edgeBirthLookup = materializedCount > 0 ? new Float64Array(pointCount * pointCount) : undefined
	if (edgeBirthLookup) {
		for (let edgeIndex = 0; edgeIndex < graph.edgeCount; edgeIndex++) {
			const source = graph.sourceIndices[edgeIndex]
			const target = graph.targetIndices[edgeIndex]
			const birth = graph.distances[edgeIndex]
			if (source === undefined || target === undefined || birth === undefined) continue
			edgeBirthLookup[source * pointCount + target] = birth
			edgeBirthLookup[target * pointCount + source] = birth
		}
	}
	const writeTriangle = (target: number, a: number, b: number, c: number) => {
		triangleA[target] = a
		triangleB[target] = b
		triangleC[target] = c
		if (edgeBirthLookup) {
			triangleBirths[target] = Math.max(
				edgeBirthLookup[a * pointCount + b] ?? 0,
				edgeBirthLookup[a * pointCount + c] ?? 0,
				edgeBirthLookup[b * pointCount + c] ?? 0,
			)
		}
	}
	if (materializedCount > 0 && materializedCount === triangleCount) {
		forEachTriangle(graph.edgeCount, graph.sourceIndices, graph.targetIndices, adjacency, (a, b, c, index) => {
			writeTriangle(index, a, b, c)
		})
	} else if (materializedCount > 0) {
		const stride = triangleCount / materializedCount
		let target = 0
		let nextSampleIndex = Math.floor(stride / 2)
		forEachTriangle(graph.edgeCount, graph.sourceIndices, graph.targetIndices, adjacency, (a, b, c, index) => {
			if (target >= materializedCount || index < nextSampleIndex) return
			writeTriangle(target, a, b, c)
			target++
			nextSampleIndex = Math.min(triangleCount - 1, Math.floor((target + 0.5) * stride))
		})
	}
	const triangles: RipsTriangleBuffer = {
		count: materializedCount,
		totalCount: triangleCount,
		truncated: materializedCount < triangleCount,
		a: triangleA,
		b: triangleB,
		c: triangleC,
		births: triangleBirths,
	}
	const graphCycleRank = graph.edgeCount - pointCount + graph.componentCount
	const warnings: string[] = []
	if (triangleCount > budget.maxTriangleCountForMaterialization) {
		warnings.push(`Triangle visualization omitted: ${triangleCount} simplices exceed the ${budget.maxTriangleCountForMaterialization} visualization ceiling.`)
	} else if (triangles.truncated) {
		warnings.push(`Triangle visualization uses a deterministic ${materializedCount}-of-${triangleCount} LOD sample.`)
	}
	let beta1: number | undefined
	let beta1Status: RipsComplexResult['beta1Status'] = 'budget-exceeded'
	if (triangleCount <= budget.maxHomologyTriangles && triangleCount <= materializedCount) {
		const boundary2Rank = rankBoundary2OverF2(pointCount, graph.edgeCount, graph.sourceIndices, graph.targetIndices, triangles)
		beta1 = graphCycleRank - boundary2Rank
		beta1Status = 'computed'
	} else {
		warnings.push(`β₁ was not computed: ${triangleCount} triangles exceed the homology budget of ${budget.maxHomologyTriangles}.`)
	}
	return {
		pointCount,
		edgeCount: graph.edgeCount,
		beta0: graph.componentCount,
		meanDegree: 2 * graph.edgeCount / pointCount,
		isolatedPointCount,
		graphCycleRank,
		triangleCount,
		triangles,
		...(beta1 === undefined ? {} : { beta1 }),
		beta1Status,
		epsilon,
		metric: 'euclidean',
		edgeSourceIndices,
		edgeTargetIndices,
		edgeBirths,
		warnings,
	}
}
