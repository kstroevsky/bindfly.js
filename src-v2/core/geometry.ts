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
