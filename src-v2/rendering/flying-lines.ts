import type { PointBuffer2D, ProximityEdgeBuffer2D } from '../core/index.ts'

export interface FlyingLinesRenderView {
	readonly background: string
	readonly particles: PointBuffer2D
	readonly edges: ProximityEdgeBuffer2D
	readonly comparison?: {
		readonly a: { readonly particles: PointBuffer2D; readonly edges: ProximityEdgeBuffer2D }
		readonly b: { readonly particles: PointBuffer2D; readonly edges: ProximityEdgeBuffer2D }
	}
	readonly difference?: FlyingLinesDifferenceView
}

export const DIFFERENCE_DISCONTINUITY_KIND = Object.freeze({
	aInvalid: 1,
	bInvalid: 2,
} as const)

export interface FlyingLinesDifferenceView {
	readonly mode: 'vector' | 'magnitude'
	readonly count: number
	readonly ids: Uint32Array
	readonly ax: Float64Array
	readonly ay: Float64Array
	readonly bx: Float64Array
	readonly by: Float64Array
	readonly magnitude: Float64Array
	readonly robustMagnitudeScale: number
	readonly outliers: Uint8Array
	readonly discontinuityCount: number
	readonly discontinuityX: Float64Array
	readonly discontinuityY: Float64Array
	readonly discontinuityKind: Uint8Array
	readonly unlocatedDiscontinuityCount: number
}
