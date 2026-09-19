import type { PointBuffer2D } from '../../core/index.ts'

export interface MovingPointParameters {
	readonly particleCount: number
	readonly maxSpeed: number
	readonly particleLifetimeSeconds: number
	readonly margin: number
}

export interface MovingPointBuffer extends PointBuffer2D {
	count: number
	capacity: number
	ids: Uint32Array
	x: Float64Array
	y: Float64Array
	velocityX: Float64Array
	velocityY: Float64Array
	lifeSeconds: Float64Array
}

export interface MovingPointState {
	readonly particles: MovingPointBuffer
}

export type MovingPointInput =
	| { readonly type: 'add-point'; readonly x: number; readonly y: number }
	| { readonly type: 'remove-nearest'; readonly x: number; readonly y: number; readonly maxDistance: number }
	| { readonly type: 'move-point'; readonly id: number; readonly x: number; readonly y: number }
	| { readonly type: 'move-nearest'; readonly fromX: number; readonly fromY: number; readonly x: number; readonly y: number; readonly maxDistance: number }
