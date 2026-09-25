import type { ParameterValues, PointBuffer2D } from '../../core/index.ts'
import type { FormulaIssue, FormulaTransform2D } from '../../formula/index.ts'

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

export interface ParametricFormulaComparisonPointBuffer {
	count: number
	readonly capacity: number
	readonly ids: Uint32Array
	readonly ax: Float64Array
	readonly ay: Float64Array
	readonly bx: Float64Array
	readonly by: Float64Array
	readonly mx: Float64Array
	readonly my: Float64Array
	readonly dx: Float64Array
	readonly dy: Float64Array
	readonly magnitude: Float64Array
	readonly validity: Uint8Array
	invalidFormulaPointCount: number
}

export interface ParametricPointDerivationInput {
	readonly state: ParametricOriginalState
	readonly kind: ParametricOriginalKind
	readonly viewportWidth: number
	readonly viewportHeight: number
	readonly weight: number
	readonly formulaParameters: Readonly<Record<string, number>>
	readonly formulaA: FormulaTransform2D
	readonly formulaB: FormulaTransform2D
	readonly formulaMorph: number
}

export type ParametricFormulaComparisonDerivationInput = ParametricPointDerivationInput

export interface ParametricFormulaScopeInput {
	readonly state: ParametricOriginalState
	readonly kind: ParametricOriginalKind
	readonly pointIndex: number
	readonly viewportWidth: number
	readonly viewportHeight: number
	readonly weight: number
	readonly formulaParameters: Readonly<Record<string, number>>
}

export interface ParametricFormulaTraceEntry {
	readonly expression: string
	readonly start: number
	readonly end: number
	readonly value: number
}

export interface ParametricFormulaAxisProbe {
	readonly value?: number
	readonly error?: FormulaIssue
	readonly trace: readonly ParametricFormulaTraceEntry[]
}

export interface ParametricFormulaTransformProbe {
	readonly x: ParametricFormulaAxisProbe
	readonly y: ParametricFormulaAxisProbe
}

export interface ParametricPointProbe {
	readonly kind: 'point-probe'
	readonly pointId: number
	readonly simulationStep: number
	readonly scope: Readonly<Record<string, number>>
	readonly validity: number
	readonly a: ParametricFormulaTransformProbe
	readonly b: ParametricFormulaTransformProbe
	readonly morph?: { readonly x: number; readonly y: number }
	readonly displacement?: { readonly dx: number; readonly dy: number; readonly magnitude: number }
}

export interface ParametricNoPointProbe {
	readonly kind: 'no-point'
}

export type ParametricPointProbeResult = ParametricPointProbe | ParametricNoPointProbe
