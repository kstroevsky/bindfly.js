export interface IdentifiedPoint2D {
	readonly id: number
	readonly x: number
	readonly y: number
}

export interface WeightedLineSegment2D {
	readonly sourceId: number
	readonly targetId: number
	readonly sourceX: number
	readonly sourceY: number
	readonly targetX: number
	readonly targetY: number
	readonly distance: number
	readonly opacity: number
}

export type FloatingPointArray = Float32Array | Float64Array

export interface PointBuffer2D {
	readonly count: number
	readonly capacity: number
	readonly ids: Uint32Array
	readonly x: FloatingPointArray
	readonly y: FloatingPointArray
}

export interface ProximityEdgeBuffer2D {
	readonly edgeCount: number
	readonly sourceIndices: Uint32Array
	readonly targetIndices: Uint32Array
	readonly distances: FloatingPointArray
	readonly opacities: FloatingPointArray
}
