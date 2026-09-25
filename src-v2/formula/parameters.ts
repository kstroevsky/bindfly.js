import type { NumberParameterDefinition } from '../core/index.ts'

import { FORMULA_FUNCTION_NAMES } from './compiler.ts'
import { identifierPattern } from './internal.ts'

export interface FormulaParameterDeclaration {
	readonly id: string
	readonly default: number
	readonly min: number
	readonly max: number
	readonly step: number
}

export type FormulaParameterSchema<Declarations extends readonly FormulaParameterDeclaration[]> = {
	readonly [Declaration in Declarations[number] as Declaration['id']]: NumberParameterDefinition
}

const assertFinite = (id: string, field: string, value: number) => {
	if (!Number.isFinite(value)) throw new Error(`Formula parameter '${id}' ${field} must be finite.`)
}

export const defineFormulaParameterDeclarations = <const Declarations extends readonly FormulaParameterDeclaration[]>(
	declarations: Declarations,
	systemVariables: readonly string[],
): Declarations => {
	const reserved = new Set([...systemVariables, ...FORMULA_FUNCTION_NAMES])
	const seen = new Set<string>()
	const frozen = declarations.map((declaration) => {
		if (!identifierPattern.test(declaration.id)) {
			throw new Error(`Formula parameter ID '${declaration.id}' is not a valid identifier.`)
		}
		if (reserved.has(declaration.id)) {
			throw new Error(`Formula parameter '${declaration.id}' collides with the canonical formula scope.`)
		}
		if (seen.has(declaration.id)) throw new Error(`Duplicate formula parameter '${declaration.id}'.`)
		seen.add(declaration.id)
		assertFinite(declaration.id, 'default', declaration.default)
		assertFinite(declaration.id, 'minimum', declaration.min)
		assertFinite(declaration.id, 'maximum', declaration.max)
		assertFinite(declaration.id, 'step', declaration.step)
		if (declaration.max < declaration.min) throw new Error(`Formula parameter '${declaration.id}' has max below min.`)
		if (declaration.default < declaration.min || declaration.default > declaration.max) {
			throw new Error(`Formula parameter '${declaration.id}' default is outside its declared range.`)
		}
		if (declaration.step <= 0) throw new Error(`Formula parameter '${declaration.id}' step must be positive.`)
		return Object.freeze({ ...declaration })
	})
	return Object.freeze(frozen) as unknown as Declarations
}

export const createFormulaParameterSchema = <const Declarations extends readonly FormulaParameterDeclaration[]>(
	declarations: Declarations,
): FormulaParameterSchema<Declarations> => Object.fromEntries(declarations.map((declaration) => [
	declaration.id,
	{
		kind: 'number' as const,
		default: declaration.default,
		min: declaration.min,
		max: declaration.max,
		step: declaration.step,
		semantic: 'formula-parameter' as const,
		invalidation: 'hot-update' as const,
	},
])) as FormulaParameterSchema<Declarations>

export const formulaParameterIds = (
	declarations: readonly FormulaParameterDeclaration[],
): readonly string[] => Object.freeze(declarations.map(({ id }) => id))

export const createFormulaParameterScope = (
	declarations: readonly FormulaParameterDeclaration[],
	values: Readonly<Record<string, unknown>>,
): Readonly<Record<string, number>> => Object.freeze(Object.fromEntries(declarations.map(({ id }) => {
	const value = values[id]
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new TypeError(`Formula parameter '${id}' must be a finite number.`)
	}
	return [id, value]
})))
