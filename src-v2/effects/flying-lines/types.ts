import type { IdentifiedPoint2D, ParameterValues } from '../../core/index.ts'

import type { flyingLinesParameters } from './parameters.ts'

export type FlyingLinesParameters = ParameterValues<typeof flyingLinesParameters>

export interface FlyingLinesParticle extends IdentifiedPoint2D {
	x: number
	y: number
	velocityX: number
	velocityY: number
	lifeSeconds: number
}

export interface FlyingLinesState {
	readonly particles: FlyingLinesParticle[]
	readonly connectionRadius: number
	readonly background: string
}

export type FlyingLinesInput =
	| { readonly type: 'add-point'; readonly x: number; readonly y: number }
	| { readonly type: 'remove-nearest'; readonly x: number; readonly y: number; readonly maxDistance: number }
	| { readonly type: 'move-point'; readonly id: number; readonly x: number; readonly y: number }
