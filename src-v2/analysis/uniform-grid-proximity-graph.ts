import type { PointBuffer2D } from '../core/index.ts'

import type { BufferedProximityGraphResult, ProximityGraphWorkspace } from './proximity-graph.ts'

const hashCell = (cellX: number, cellY: number): number =>
	Math.imul(cellX, 73856093) ^ Math.imul(cellY, 19349663)

export const shouldUseUniformGrid = (points: PointBuffer2D, connectionRadius: number): boolean => {
	if (points.count < 64 || !Number.isFinite(connectionRadius) || connectionRadius <= 0) return false
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	for (let index = 0; index < points.count; index++) {
		const x = points.x[index] ?? 0
		const y = points.y[index] ?? 0
		if (x < minX) minX = x
		if (x > maxX) maxX = x
		if (y < minY) minY = y
		if (y > maxY) maxY = y
	}
	const occupiedArea = Math.max(connectionRadius, maxX - minX) * Math.max(connectionRadius, maxY - minY)
	const neighborhoodAreaRatio = 9 * connectionRadius * connectionRadius / occupiedArea
	return neighborhoodAreaRatio <= 0.05
}

export const createUniformGridProximityGraphWorkspace = (maximumPointCount: number): ProximityGraphWorkspace => {
	if (!Number.isInteger(maximumPointCount) || maximumPointCount <= 0) {
		throw new RangeError('maximumPointCount must be a positive integer.')
	}
	const maximumEdgeCount = maximumPointCount * (maximumPointCount - 1) / 2
	const result: BufferedProximityGraphResult = {
		edgeCount: 0,
		sourceIndices: new Uint32Array(maximumEdgeCount),
		targetIndices: new Uint32Array(maximumEdgeCount),
		distances: new Float64Array(maximumEdgeCount),
		opacities: new Float64Array(maximumEdgeCount),
		degrees: new Uint32Array(maximumPointCount),
		componentCount: 0,
	}
	let tableCapacity = 16
	while (tableCapacity < maximumPointCount * 4) tableCapacity *= 2
	const tableMask = tableCapacity - 1
	const slotCellX = new Int32Array(tableCapacity)
	const slotCellY = new Int32Array(tableCapacity)
	const heads = new Int32Array(tableCapacity)
	const next = new Int32Array(maximumPointCount)
	const candidates = new Uint32Array(maximumPointCount)
	const parent = new Uint32Array(maximumPointCount)
	const rank = new Uint8Array(maximumPointCount)

	const findSlot = (cellX: number, cellY: number): number => {
		let slot = hashCell(cellX, cellY) & tableMask
		while (heads[slot] !== -1 && (slotCellX[slot] !== cellX || slotCellY[slot] !== cellY)) {
			slot = (slot + 1) & tableMask
		}
		return slot
	}
	const find = (index: number): number => {
		let root = index
		while (parent[root] !== root) root = parent[root] ?? root
		while (parent[index] !== index) {
			const nextIndex = parent[index] ?? index
			parent[index] = root
			index = nextIndex
		}
		return root
	}
	const connect = (sourceIndex: number, targetIndex: number): void => {
		let sourceRoot = find(sourceIndex)
		let targetRoot = find(targetIndex)
		if (sourceRoot === targetRoot) return
		if ((rank[sourceRoot] ?? 0) < (rank[targetRoot] ?? 0)) {
			const previousSourceRoot = sourceRoot
			sourceRoot = targetRoot
			targetRoot = previousSourceRoot
		}
		parent[targetRoot] = sourceRoot
		if (rank[sourceRoot] === rank[targetRoot]) rank[sourceRoot] = (rank[sourceRoot] ?? 0) + 1
		result.componentCount--
	}

	return {
		result,
		analyze: (points: PointBuffer2D, connectionRadius: number) => {
			if (!Number.isFinite(connectionRadius) || connectionRadius <= 0) {
				throw new RangeError('Connection radius must be a positive finite number.')
			}
			if (points.count > maximumPointCount) {
				throw new RangeError(`Point count ${points.count} exceeds workspace maximum ${maximumPointCount}.`)
			}
			result.edgeCount = 0
			result.componentCount = points.count
			result.degrees.fill(0, 0, points.count)
			rank.fill(0, 0, points.count)
			heads.fill(-1)
			for (let index = 0; index < points.count; index++) {
				parent[index] = index
				const cellX = Math.floor((points.x[index] ?? 0) / connectionRadius)
				const cellY = Math.floor((points.y[index] ?? 0) / connectionRadius)
				const slot = findSlot(cellX, cellY)
				if (heads[slot] === -1) {
					slotCellX[slot] = cellX
					slotCellY[slot] = cellY
				}
				next[index] = heads[slot] ?? -1
				heads[slot] = index
			}

			const radiusSquared = connectionRadius * connectionRadius
			for (let sourceIndex = 0; sourceIndex < points.count; sourceIndex++) {
				const sourceCellX = Math.floor((points.x[sourceIndex] ?? 0) / connectionRadius)
				const sourceCellY = Math.floor((points.y[sourceIndex] ?? 0) / connectionRadius)
				let candidateCount = 0
				for (let offsetY = -1; offsetY <= 1; offsetY++) {
					for (let offsetX = -1; offsetX <= 1; offsetX++) {
						const slot = findSlot(sourceCellX + offsetX, sourceCellY + offsetY)
						for (let targetIndex = heads[slot] ?? -1; targetIndex >= 0; targetIndex = next[targetIndex] ?? -1) {
							if (targetIndex > sourceIndex) candidates[candidateCount++] = targetIndex
						}
					}
				}
				for (let index = 1; index < candidateCount; index++) {
					const value = candidates[index] ?? 0
					let insertionIndex = index
					while (insertionIndex > 0 && (candidates[insertionIndex - 1] ?? 0) > value) {
						candidates[insertionIndex] = candidates[insertionIndex - 1] ?? 0
						insertionIndex--
					}
					candidates[insertionIndex] = value
				}
				for (let candidateIndex = 0; candidateIndex < candidateCount; candidateIndex++) {
					const targetIndex = candidates[candidateIndex] ?? 0
					const dx = (points.x[targetIndex] ?? 0) - (points.x[sourceIndex] ?? 0)
					const dy = (points.y[targetIndex] ?? 0) - (points.y[sourceIndex] ?? 0)
					const distanceSquared = dx * dx + dy * dy
					if (distanceSquared > radiusSquared) continue
					const edgeIndex = result.edgeCount++
					const distance = Math.sqrt(distanceSquared)
					result.sourceIndices[edgeIndex] = sourceIndex
					result.targetIndices[edgeIndex] = targetIndex
					result.distances[edgeIndex] = distance
					result.opacities[edgeIndex] = 1 - distance / connectionRadius
					result.degrees[sourceIndex] = (result.degrees[sourceIndex] ?? 0) + 1
					result.degrees[targetIndex] = (result.degrees[targetIndex] ?? 0) + 1
					connect(sourceIndex, targetIndex)
				}
			}
			return result
		},
	}
}
