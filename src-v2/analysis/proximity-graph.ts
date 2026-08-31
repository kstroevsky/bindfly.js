import type { AnalyzerDefinition, IdentifiedPoint2D, WeightedLineSegment2D } from '../core/index.ts'

export interface ProximityGraphInput {
	readonly points: readonly IdentifiedPoint2D[]
	readonly connectionRadius: number
}

export interface PointDegree {
	readonly id: number
	readonly degree: number
}

export interface ProximityGraphResult {
	readonly edges: readonly WeightedLineSegment2D[]
	readonly components: readonly (readonly number[])[]
	readonly degrees: readonly PointDegree[]
}

export interface ProximityGraphState {
	readonly particles: readonly IdentifiedPoint2D[]
	readonly connectionRadius: number
}

class UnionFind {
	private readonly parent: number[]
	private readonly rank: number[]

	constructor(size: number) {
		this.parent = Array.from({ length: size }, (_, index) => index)
		this.rank = Array.from({ length: size }, () => 0)
	}

	find(index: number): number {
		const parent = this.parent[index]
		if (parent === undefined) throw new RangeError(`Union-Find index ${index} is missing.`)
		if (parent === index) return index
		const root = this.find(parent)
		this.parent[index] = root
		return root
	}

	union(first: number, second: number): void {
		const firstRoot = this.find(first)
		const secondRoot = this.find(second)
		if (firstRoot === secondRoot) return

		const firstRank = this.rank[firstRoot] ?? 0
		const secondRank = this.rank[secondRoot] ?? 0

		if (firstRank < secondRank) this.parent[firstRoot] = secondRoot
		else if (firstRank > secondRank) this.parent[secondRoot] = firstRoot
		else {
			this.parent[secondRoot] = firstRoot
			this.rank[firstRoot] = firstRank + 1
		}
	}
}

export const analyzeProximityGraph = ({
	points,
	connectionRadius,
}: ProximityGraphInput): ProximityGraphResult => {
	if (!Number.isFinite(connectionRadius) || connectionRadius <= 0) {
		throw new RangeError('Connection radius must be a positive finite number.')
	}

	const radiusSquared = connectionRadius * connectionRadius
	const unionFind = new UnionFind(points.length)
	const degrees = new Map(points.map(({ id }) => [id, 0]))
	const edges: WeightedLineSegment2D[] = []

	for (let sourceIndex = 0; sourceIndex < points.length; sourceIndex++) {
		const source = points[sourceIndex]
		if (!source) continue

		for (let targetIndex = sourceIndex + 1; targetIndex < points.length; targetIndex++) {
			const target = points[targetIndex]
			if (!target) continue

			const dx = target.x - source.x
			const dy = target.y - source.y
			const distanceSquared = dx * dx + dy * dy
			if (distanceSquared > radiusSquared) continue

			const distance = Math.sqrt(distanceSquared)
			edges.push({
				sourceId: source.id,
				targetId: target.id,
				sourceX: source.x,
				sourceY: source.y,
				targetX: target.x,
				targetY: target.y,
				distance,
				opacity: 1 - distance / connectionRadius,
			})
			degrees.set(source.id, (degrees.get(source.id) ?? 0) + 1)
			degrees.set(target.id, (degrees.get(target.id) ?? 0) + 1)
			unionFind.union(sourceIndex, targetIndex)
		}
	}

	const componentMap = new Map<number, number[]>()
	for (let index = 0; index < points.length; index++) {
		const point = points[index]
		if (!point) continue
		const root = unionFind.find(index)
		const component = componentMap.get(root) ?? []
		component.push(point.id)
		componentMap.set(root, component)
	}

	const components = [...componentMap.values()]
		.map((component) => component.sort((left, right) => left - right))
		.sort((left, right) => (left[0] ?? 0) - (right[0] ?? 0))

	return {
		edges,
		components,
		degrees: points.map(({ id }) => ({ id, degree: degrees.get(id) ?? 0 })),
	}
}

export const proximityGraphAnalyzer: AnalyzerDefinition<ProximityGraphState, ProximityGraphResult> = {
	id: 'proximity-graph',
	analyze: (snapshot, _context, signal) => {
		if (signal.aborted) return Promise.reject(signal.reason)
		const value = analyzeProximityGraph({
			points: snapshot.state.particles,
			connectionRadius: snapshot.state.connectionRadius,
		})
		return {
			value,
			provenance: {
				snapshotId: snapshot.snapshotId,
				experimentId: snapshot.experimentId,
				stateVersion: snapshot.stateVersion,
				simulationStepIndex: snapshot.simulationStepIndex,
				backendId: 'brute-force-proximity-graph',
				backendVersion: '1',
				durationMs: 0,
				sampledItemCount: snapshot.state.particles.length,
				inputItemCount: snapshot.state.particles.length,
				warnings: [],
			},
		}
	},
}
