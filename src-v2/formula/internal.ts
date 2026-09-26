import type { FormulaIssue, FormulaLimitOverrides, FormulaLimits } from './contracts.ts'
import { DEFAULT_FORMULA_LIMITS } from './contracts.ts'

export const issue = (code: FormulaIssue['code'], message: string, index?: number): FormulaIssue => ({
	code,
	message,
	...(index === undefined ? {} : { index }),
})

export const resolveFormulaLimits = (
	overrides: FormulaLimitOverrides = {},
): { readonly ok: true; readonly value: FormulaLimits } | { readonly ok: false; readonly error: FormulaIssue } => {
	const keys = Object.keys(DEFAULT_FORMULA_LIMITS) as Array<keyof FormulaLimits>
	const result = { ...DEFAULT_FORMULA_LIMITS }
	for (const key of keys) {
		const value = overrides[key]
		if (value === undefined) continue
		if (!Number.isInteger(value) || value <= 0 || value > DEFAULT_FORMULA_LIMITS[key]) {
			return {
				ok: false,
				error: issue('invalid-limit', `Formula limit '${key}' must be a positive integer no greater than ${DEFAULT_FORMULA_LIMITS[key]}.`),
			}
		}
		result[key] = value
	}
	return { ok: true, value: result }
}

export const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
