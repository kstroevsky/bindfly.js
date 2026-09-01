import type { ParameterValues, PointBuffer2D } from '../../core/index.ts'

import type { flyingLinesParameters } from './parameters.ts'

export type FlyingLinesParameters = ParameterValues<typeof flyingLinesParameters>

export interface FlyingLinesParticleBuffer extends PointBuffer2D {
	count: number
	capacity: number
	ids: Uint32Array
	x: Float64Array
	y: Float64Array
	velocityX: Float64Array
	velocityY: Float64Array
	lifeSeconds: Float64Array
}

export interface FlyingLinesState {
	readonly particles: FlyingLinesParticleBuffer
	readonly connectionRadius: number
	readonly background: string
}

export type FlyingLinesInput =
	| { readonly type: 'add-point'; readonly x: number; readonly y: number }
	| { readonly type: 'remove-nearest'; readonly x: number; readonly y: number; readonly maxDistance: number }
	| { readonly type: 'move-point'; readonly id: number; readonly x: number; readonly y: number }
