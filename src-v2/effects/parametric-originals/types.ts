import type { ParameterValues, PointBuffer2D } from '../../core/index.ts'
import type { FormulaTransform2D } from '../../formula/index.ts'

import type { createParametricOriginalParameters } from './parameters.ts'

export type ParametricOriginalKind = 'pulse' | 'spiral'
export type ParametricOriginalParameters = ParameterValues<ReturnType<typeof createParametricOriginalParameters>>
export type ParametricOriginalInput = { readonly type: 'set-center'; readonly x: number; readonly y: number }

export interface ParametricPhaseBuffer {
	count: number
	readonly capacity: number
	readonly values: Float64Array
}

export interface ParametricOriginalState {
	readonly phases: ParametricPhaseBuffer
	accumulator: number
	reverse: boolean
	centerX: number
	centerY: number
}

export interface ParametricPointBuffer extends PointBuffer2D {
	count: number
	readonly capacity: number
	readonly ids: Uint32Array
	readonly x: Float64Array
	readonly y: Float64Array
	invalidFormulaPointCount: number
}

export interface ParametricPointDerivationInput {
	readonly state: ParametricOriginalState
	readonly kind: ParametricOriginalKind
	readonly viewportWidth: number
	readonly viewportHeight: number
	readonly weight: number
	readonly formulaA: FormulaTransform2D
	readonly formulaB: FormulaTransform2D
	readonly formulaMorph: number
}
