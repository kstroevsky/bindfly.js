import type { ParameterValues, WeightedLineSegmentBuffer2D } from '../../core/index.ts'
import type { FlyingLinesInput, FlyingLinesParticleBuffer } from '../flying-lines/types.ts'

import type { droopingLinesParameters } from './parameters.ts'

export type DroopingLinesParameters = ParameterValues<typeof droopingLinesParameters>
export type DroopingLinesInput = FlyingLinesInput
export type DroopingLinesParticleBuffer = FlyingLinesParticleBuffer

export interface DroopingLinesState {
	readonly particles: DroopingLinesParticleBuffer
}

export interface DroopingLineBuffer extends WeightedLineSegmentBuffer2D { count: number }

export interface DroopingGeometryInput {
	readonly particles: DroopingLinesParticleBuffer
	readonly connectionRadius: number
	readonly deformation: DroopingLinesParameters['deformation']
}
