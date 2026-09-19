import type { Result } from '../../core/index.ts'
import { compileFormulaTransform2D } from '../../formula/index.ts'
import type { FormulaTransform2D } from '../../formula/index.ts'

import type { ParametricOriginalParameters } from './types.ts'

export const PARAMETRIC_ORIGINAL_VARIABLES = Object.freeze([
	'a', 'angle', 'distance', 'positionX', 'positionY', 'weight',
] as const)

export interface ParametricOriginalFormulaPair {
	readonly a: FormulaTransform2D
	readonly b: FormulaTransform2D
}

export const compileParametricOriginalFormulaPair = (
	parameters: Pick<ParametricOriginalParameters, 'formulaAX' | 'formulaAY' | 'formulaBX' | 'formulaBY'>,
): Result<ParametricOriginalFormulaPair, string> => {
	const a = compileFormulaTransform2D({
		xSource: parameters.formulaAX,
		ySource: parameters.formulaAY,
		variables: PARAMETRIC_ORIGINAL_VARIABLES,
	})
	if (!a.ok) return { ok: false, error: `Formula A: ${a.error.message}` }
	const b = compileFormulaTransform2D({
		xSource: parameters.formulaBX,
		ySource: parameters.formulaBY,
		variables: PARAMETRIC_ORIGINAL_VARIABLES,
	})
	if (!b.ok) return { ok: false, error: `Formula B: ${b.error.message}` }
	return { ok: true, value: { a: a.value, b: b.value } }
}
