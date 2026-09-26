import type { ParameterValues, WeightedLineSegmentBuffer2D } from '../../core/index.ts'
import type { FormulaTransform2D } from '../../formula/index.ts'
import type { MovingPointBuffer, MovingPointInput, MovingPointState } from '../moving-points/types.ts'

import type { droopingLinesParameters } from './parameters.ts'

export type DroopingLinesParameters = ParameterValues<typeof droopingLinesParameters>
export type DroopingLinesInput = MovingPointInput
export type DroopingLinesParticleBuffer = MovingPointBuffer
export type DroopingLinesState = MovingPointState

export interface DroopingLineBuffer extends WeightedLineSegmentBuffer2D {
	count: number
	invalidFormulaPointCount: number
}

export interface DroopingGeometryInput {
	readonly particles: DroopingLinesParticleBuffer
	readonly connectionRadius: number
	readonly formulaA: FormulaTransform2D
	readonly formulaB: FormulaTransform2D
	readonly formulaMorph: DroopingLinesParameters['formulaMorph']
}
