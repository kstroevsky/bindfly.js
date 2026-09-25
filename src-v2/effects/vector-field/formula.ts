import type { Result } from '../../core/index.ts'
import {
	compileFormula,
	createFormulaParameterScope,
	evaluateFormula,
	formulaParameterIds,
} from '../../formula/index.ts'
import type { FormulaIssue, FormulaProgram } from '../../formula/index.ts'

import {
	VECTOR_FIELD_FORMULA_PARAMETERS,
	VECTOR_FIELD_SYSTEM_VARIABLES,
} from './parameters.ts'
import type { VectorFieldParameters } from './types.ts'

export const VECTOR_FIELD_VARIABLES = Object.freeze([
	...VECTOR_FIELD_SYSTEM_VARIABLES,
	...formulaParameterIds(VECTOR_FIELD_FORMULA_PARAMETERS),
])

export interface VectorFieldPrograms {
	readonly dx: FormulaProgram
	readonly dy: FormulaProgram
}

export const compileVectorFieldPrograms = (
	parameters: Pick<VectorFieldParameters, 'dxFormula' | 'dyFormula'>,
): Result<VectorFieldPrograms, string> => {
	const dx = compileFormula(parameters.dxFormula, { variables: VECTOR_FIELD_VARIABLES })
	if (!dx.ok) return { ok: false, error: `dx/dt: ${dx.error.message}` }
	const dy = compileFormula(parameters.dyFormula, { variables: VECTOR_FIELD_VARIABLES })
	if (!dy.ok) return { ok: false, error: `dy/dt: ${dy.error.message}` }
	return { ok: true, value: { dx: dx.value, dy: dy.value } }
}

export const createVectorFieldScope = (
	parameters: VectorFieldParameters,
	x: number,
	y: number,
	t: number,
): Readonly<Record<string, number>> => ({
	x,
	y,
	t,
	...createFormulaParameterScope(VECTOR_FIELD_FORMULA_PARAMETERS, parameters),
})

export const evaluateVectorField = (
	programs: VectorFieldPrograms,
	scope: Readonly<Record<string, number>>,
): Result<{ readonly dx: number; readonly dy: number }, FormulaIssue> => {
	const dx = evaluateFormula(programs.dx, scope)
	if (!dx.ok) return dx
	const dy = evaluateFormula(programs.dy, scope)
	if (!dy.ok) return dy
	return { ok: true, value: { dx: dx.value, dy: dy.value } }
}
