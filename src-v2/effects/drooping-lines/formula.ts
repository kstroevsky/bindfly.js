import type { Result } from '../../core/index.ts'
import { compileFormulaTransform2D } from '../../formula/index.ts'
import type { FormulaTransform2D } from '../../formula/index.ts'

import type { DroopingLinesParameters } from './types.ts'

export const DROOPING_FORMULA_VARIABLES = Object.freeze(['x', 'y'] as const)

export interface DroopingFormulaPair {
	readonly a: FormulaTransform2D
	readonly b: FormulaTransform2D
}

export const compileDroopingFormulaPair = (
	parameters: Pick<DroopingLinesParameters, 'formulaAX' | 'formulaAY' | 'formulaBX' | 'formulaBY'>,
): Result<DroopingFormulaPair, string> => {
	const a = compileFormulaTransform2D({
		xSource: parameters.formulaAX,
		ySource: parameters.formulaAY,
		variables: DROOPING_FORMULA_VARIABLES,
	})
	if (!a.ok) return { ok: false, error: `Formula A: ${a.error.message}` }
	const b = compileFormulaTransform2D({
		xSource: parameters.formulaBX,
		ySource: parameters.formulaBY,
		variables: DROOPING_FORMULA_VARIABLES,
	})
	if (!b.ok) return { ok: false, error: `Formula B: ${b.error.message}` }
	return { ok: true, value: { a: a.value, b: b.value } }
}
