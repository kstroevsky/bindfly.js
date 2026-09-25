import type { Result } from '../../core/index.ts'
import {
	compileFormula,
	createFormulaParameterScope,
	evaluateFormula,
	formulaParameterIds,
} from '../../formula/index.ts'
import type { FormulaIssue, FormulaProgram } from '../../formula/index.ts'

import {
	SCALAR_FIELD_FORMULA_PARAMETERS,
	SCALAR_FIELD_SYSTEM_VARIABLES,
} from './parameters.ts'
import type { ScalarFieldParameters } from './types.ts'

export const SCALAR_FIELD_VARIABLES = Object.freeze([
	...SCALAR_FIELD_SYSTEM_VARIABLES,
	...formulaParameterIds(SCALAR_FIELD_FORMULA_PARAMETERS),
])

export const compileScalarFieldProgram = (
	parameters: Pick<ScalarFieldParameters, 'formula'>,
): Result<FormulaProgram, string> => {
	const compiled = compileFormula(parameters.formula, { variables: SCALAR_FIELD_VARIABLES })
	return compiled.ok ? compiled : { ok: false, error: `z(x,y): ${compiled.error.message}` }
}

export const createScalarFieldScope = (
	parameters: ScalarFieldParameters,
	x: number,
	y: number,
): Readonly<Record<string, number>> => ({
	x,
	y,
	...createFormulaParameterScope(SCALAR_FIELD_FORMULA_PARAMETERS, parameters),
})

export const evaluateScalarField = (
	program: FormulaProgram,
	scope: Readonly<Record<string, number>>,
): Result<number, FormulaIssue> => evaluateFormula(program, scope)
