import type { Result } from '../core/index.ts'
import { compileFormula } from './compiler.ts'
import type {
	CompileFormulaTransform2DInput,
	FormulaIssue,
	FormulaProgram,
	FormulaTransformComparison2D,
	FormulaTransformComparisonDetailedResult2D,
	FormulaTransformComparisonResult2D,
	FormulaTransform2D,
} from './contracts.ts'
import {
	FORMULA_PROGRAM_FORMAT,
	FORMULA_PROGRAM_VERSION,
	FORMULA_TRANSFORM_FORMAT,
	FORMULA_TRANSFORM_VERSION,
} from './contracts.ts'
import { evaluateFormula } from './interpreter.ts'
import { issue } from './internal.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

export const serializeFormulaProgram = (program: FormulaProgram): string => JSON.stringify({
	format: FORMULA_PROGRAM_FORMAT,
	version: FORMULA_PROGRAM_VERSION,
	source: program.source,
	variables: program.variables,
	operationLimit: program.operationLimit,
})

export const parseFormulaProgram = (serialized: unknown): Result<FormulaProgram, FormulaIssue> => {
	let value: unknown = serialized
	if (typeof serialized === 'string') {
		try { value = JSON.parse(serialized) as unknown } catch {
			return { ok: false, error: issue('invalid-serialization', 'Formula program is not valid JSON.') }
		}
	}
	if (!isRecord(value) || value.format !== FORMULA_PROGRAM_FORMAT) {
		return { ok: false, error: issue('invalid-serialization', 'Formula program format is invalid.') }
	}
	if (value.version !== FORMULA_PROGRAM_VERSION) {
		return { ok: false, error: issue('unsupported-version', `Formula program version '${String(value.version)}' is unsupported.`) }
	}
	if (typeof value.source !== 'string'
		|| !Array.isArray(value.variables)
		|| !value.variables.every((item): item is string => typeof item === 'string')
		|| typeof value.operationLimit !== 'number') {
		return { ok: false, error: issue('invalid-serialization', 'Formula program fields are invalid.') }
	}
	return compileFormula(value.source, {
		variables: value.variables,
		limits: { maxOperations: value.operationLimit },
	})
}

export const compileFormulaTransform2D = (
	input: CompileFormulaTransform2DInput,
): Result<FormulaTransform2D, FormulaIssue> => {
	const x = compileFormula(input.xSource, input)
	if (!x.ok) return x
	const y = compileFormula(input.ySource, input)
	if (!y.ok) return y
	return { ok: true, value: { version: FORMULA_TRANSFORM_VERSION, x: x.value, y: y.value } }
}

export const evaluateFormulaTransform2D = (
	transform: FormulaTransform2D,
	scope: Readonly<Record<string, number>>,
): Result<{ readonly x: number; readonly y: number }, FormulaIssue> => {
	const x = evaluateFormula(transform.x, scope)
	if (!x.ok) return x
	const y = evaluateFormula(transform.y, scope)
	return y.ok ? { ok: true, value: { x: x.value, y: y.value } } : y
}

/**
 * Evaluates both transforms against the same scope, then linearly interpolates
 * their output coordinates. Formula source and syntax are never interpolated.
 */
export const evaluateFormulaTransformComparison2D = (
	comparison: FormulaTransformComparison2D,
	scope: Readonly<Record<string, number>>,
): Result<FormulaTransformComparisonResult2D, FormulaIssue> => {
	const detailed = evaluateFormulaTransformComparisonDetailed2D(comparison, scope)
	if (!detailed.ok) return detailed
	if (!detailed.value.a.ok) return detailed.value.a
	if (!detailed.value.b.ok) return detailed.value.b
	const morphed = detailed.value.morphed
	if (!morphed) return { ok: false, error: issue('invalid-program', 'Valid comparison branches require a morphed result.') }
	return {
		ok: true,
		value: {
			a: detailed.value.a.value,
			b: detailed.value.b.value,
			morphed,
		},
	}
}

export const evaluateFormulaTransformComparisonDetailed2D = (
	comparison: FormulaTransformComparison2D,
	scope: Readonly<Record<string, number>>,
): Result<FormulaTransformComparisonDetailedResult2D, FormulaIssue> => {
	if (!Number.isFinite(comparison.morph) || comparison.morph < 0 || comparison.morph > 1) {
		return { ok: false, error: issue('numeric-domain', 'Formula morph must be finite and between 0 and 1.') }
	}
	const a = evaluateFormulaTransform2D(comparison.a, scope)
	const b = evaluateFormulaTransform2D(comparison.b, scope)
	if (!a.ok || !b.ok) return { ok: true, value: { a, b } }
	const inverse = 1 - comparison.morph
	return {
		ok: true,
		value: {
			a,
			b,
			morphed: {
				x: inverse * a.value.x + comparison.morph * b.value.x,
				y: inverse * a.value.y + comparison.morph * b.value.y,
			},
		},
	}
}

export const serializeFormulaTransform2D = (transform: FormulaTransform2D): string => JSON.stringify({
	format: FORMULA_TRANSFORM_FORMAT,
	version: FORMULA_TRANSFORM_VERSION,
	x: JSON.parse(serializeFormulaProgram(transform.x)) as unknown,
	y: JSON.parse(serializeFormulaProgram(transform.y)) as unknown,
})

export const parseFormulaTransform2D = (serialized: unknown): Result<FormulaTransform2D, FormulaIssue> => {
	let value: unknown = serialized
	if (typeof serialized === 'string') {
		try { value = JSON.parse(serialized) as unknown } catch {
			return { ok: false, error: issue('invalid-serialization', 'Formula transform is not valid JSON.') }
		}
	}
	if (!isRecord(value) || value.format !== FORMULA_TRANSFORM_FORMAT) {
		return { ok: false, error: issue('invalid-serialization', 'Formula transform format is invalid.') }
	}
	if (value.version !== FORMULA_TRANSFORM_VERSION) {
		return { ok: false, error: issue('unsupported-version', `Formula transform version '${String(value.version)}' is unsupported.`) }
	}
	const x = parseFormulaProgram(value.x)
	if (!x.ok) return x
	const y = parseFormulaProgram(value.y)
	return y.ok
		? { ok: true, value: { version: FORMULA_TRANSFORM_VERSION, x: x.value, y: y.value } }
		: y
}
