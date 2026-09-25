import type { PointBuffer2D } from '../core/index.ts'
import { createProximityGraphWorkspace } from './proximity-graph.ts'
import type { PointCloudSnapshot } from './point-cloud-snapshot.ts'

export const POINT_CLOUD_STRUCTURE_ANALYZER_ID = 'point-cloud-structure'
export const POINT_CLOUD_STRUCTURE_ANALYZER_VERSION = '1'

export interface PointCloudStructureResult {
	readonly pointCount: number
	readonly edgeCount: number
	readonly beta0: number
	readonly meanDegree: number
	readonly isolatedPointCount: number
	readonly graphCycleRank: number
	readonly epsilon: number
	readonly metric: 'euclidean'
}

export const analyzePointCloudStructure = (
	snapshot: PointCloudSnapshot,
	epsilon: number,
): PointCloudStructureResult => {
	if (!Number.isFinite(epsilon) || epsilon <= 0) throw new RangeError('Analysis epsilon must be a positive finite number.')
	const count = snapshot.ids.length
	if (count === 0) return {
		pointCount: 0, edgeCount: 0, beta0: 0, meanDegree: 0, isolatedPointCount: 0, graphCycleRank: 0,
		epsilon, metric: 'euclidean',
	}
	const points: PointBuffer2D = { count, capacity: count, ids: snapshot.ids, x: snapshot.x, y: snapshot.y }
	const graph = createProximityGraphWorkspace(count).analyze(points, epsilon)
	let isolatedPointCount = 0
	for (let index = 0; index < count; index++) if ((graph.degrees[index] ?? 0) === 0) isolatedPointCount++
	return {
		pointCount: count,
		edgeCount: graph.edgeCount,
		beta0: graph.componentCount,
		meanDegree: count === 0 ? 0 : 2 * graph.edgeCount / count,
		isolatedPointCount,
		graphCycleRank: graph.edgeCount - count + graph.componentCount,
		epsilon,
		metric: 'euclidean',
	}
}
