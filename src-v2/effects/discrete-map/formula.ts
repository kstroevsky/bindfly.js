import type { Result } from '../../core/index.ts'
import {
	compileFormula,
	createFormulaParameterScope,
	evaluateFormula,
	formulaParameterIds,
} from '../../formula/index.ts'
import type { FormulaIssue, FormulaProgram } from '../../formula/index.ts'

import {
	DISCRETE_MAP_FORMULA_PARAMETERS,
	DISCRETE_MAP_SYSTEM_VARIABLES,
} from './parameters.ts'
import type { DiscreteMapParameters } from './types.ts'

export const DISCRETE_MAP_VARIABLES = Object.freeze([
	...DISCRETE_MAP_SYSTEM_VARIABLES,
	...formulaParameterIds(DISCRETE_MAP_FORMULA_PARAMETERS),
])

export interface DiscreteMapPrograms {
	readonly nextX: FormulaProgram
	readonly nextY: FormulaProgram
}

export const compileDiscreteMapPrograms = (
	parameters: Pick<DiscreteMapParameters, 'nextXFormula' | 'nextYFormula'>,
): Result<DiscreteMapPrograms, string> => {
	const nextX = compileFormula(parameters.nextXFormula, { variables: DISCRETE_MAP_VARIABLES })
	if (!nextX.ok) return { ok: false, error: `x[n+1]: ${nextX.error.message}` }
	const nextY = compileFormula(parameters.nextYFormula, { variables: DISCRETE_MAP_VARIABLES })
	if (!nextY.ok) return { ok: false, error: `y[n+1]: ${nextY.error.message}` }
	return { ok: true, value: { nextX: nextX.value, nextY: nextY.value } }
}

export const createDiscreteMapScope = (
	parameters: DiscreteMapParameters,
	x: number,
	y: number,
	n: number,
): Readonly<Record<string, number>> => ({
	x,
	y,
	n,
	...createFormulaParameterScope(DISCRETE_MAP_FORMULA_PARAMETERS, parameters),
})

export const evaluateDiscreteMap = (
	programs: DiscreteMapPrograms,
	scope: Readonly<Record<string, number>>,
): Result<{ readonly x: number; readonly y: number }, FormulaIssue> => {
	const nextX = evaluateFormula(programs.nextX, scope)
	if (!nextX.ok) return nextX
	const nextY = evaluateFormula(programs.nextY, scope)
	if (!nextY.ok) return nextY
	return { ok: true, value: { x: nextX.value, y: nextY.value } }
}
