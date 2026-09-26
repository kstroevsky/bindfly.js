import type { Result } from '../core/index.ts'
import type {
	CompileFormulaExperimentInput,
	FormulaExperiment,
	FormulaIssue,
} from './contracts.ts'
import {
	FORMULA_EXPERIMENT_FORMAT,
	FORMULA_EXPERIMENT_VERSION,
} from './contracts.ts'
import { identifierPattern, issue } from './internal.ts'
import {
	compileFormulaTransform2D,
	evaluateFormulaTransform2D,
	parseFormulaTransform2D,
	serializeFormulaTransform2D,
} from './program.ts'

const experimentIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeConfiguration = (
	configuration: Readonly<Record<string, number>>,
	variables: readonly string[],
): Result<Readonly<Record<string, number>>, FormulaIssue> => {
	const allowed = new Set(variables)
	const normalized: Record<string, number> = {}
	for (const name of Object.keys(configuration).sort()) {
		if (!identifierPattern.test(name) || !allowed.has(name)) {
			return { ok: false, error: issue('unknown-variable', `Configuration variable '${name}' is not declared by the formula experiment.`) }
		}
		const value = configuration[name]
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			return { ok: false, error: issue('non-finite-input', `Configuration variable '${name}' must be finite.`) }
		}
		normalized[name] = value
	}
	return { ok: true, value: Object.freeze(normalized) }
}

export const compileFormulaExperiment = (
	input: CompileFormulaExperimentInput,
): Result<FormulaExperiment, FormulaIssue> => {
	if (!experimentIdPattern.test(input.id)) {
		return { ok: false, error: issue('invalid-identifier', `Formula experiment ID '${input.id}' is invalid.`) }
	}
	const transform = compileFormulaTransform2D(input)
	if (!transform.ok) return transform
	const configuration = normalizeConfiguration(input.configuration ?? {}, transform.value.x.variables)
	if (!configuration.ok) return configuration
	return {
		ok: true,
		value: {
			version: FORMULA_EXPERIMENT_VERSION,
			id: input.id,
			transform: transform.value,
			configuration: configuration.value,
		},
	}
}

export const evaluateFormulaExperiment = (
	experiment: FormulaExperiment,
	scope: Readonly<Record<string, number>>,
) => evaluateFormulaTransform2D(experiment.transform, { ...scope, ...experiment.configuration })

export const serializeFormulaExperiment = (experiment: FormulaExperiment): string => JSON.stringify({
	format: FORMULA_EXPERIMENT_FORMAT,
	version: FORMULA_EXPERIMENT_VERSION,
	id: experiment.id,
	configuration: experiment.configuration,
	transform: JSON.parse(serializeFormulaTransform2D(experiment.transform)) as unknown,
})

export const parseFormulaExperiment = (serialized: unknown): Result<FormulaExperiment, FormulaIssue> => {
	let value: unknown = serialized
	if (typeof serialized === 'string') {
		try { value = JSON.parse(serialized) as unknown } catch {
			return { ok: false, error: issue('invalid-serialization', 'Formula experiment is not valid JSON.') }
		}
	}
	if (!isRecord(value) || value.format !== FORMULA_EXPERIMENT_FORMAT) {
		return { ok: false, error: issue('invalid-serialization', 'Formula experiment format is invalid.') }
	}
	if (value.version !== FORMULA_EXPERIMENT_VERSION) {
		return { ok: false, error: issue('unsupported-version', `Formula experiment version '${String(value.version)}' is unsupported.`) }
	}
	if (typeof value.id !== 'string' || !experimentIdPattern.test(value.id) || !isRecord(value.configuration)) {
		return { ok: false, error: issue('invalid-serialization', 'Formula experiment fields are invalid.') }
	}
	const transform = parseFormulaTransform2D(value.transform)
	if (!transform.ok) return transform
	if (transform.value.x.variables.join('\0') !== transform.value.y.variables.join('\0')) {
		return { ok: false, error: issue('invalid-serialization', 'Formula transform programs must share one variable allowlist.') }
	}
	const configuration = normalizeConfiguration(value.configuration as Record<string, number>, transform.value.x.variables)
	if (!configuration.ok) return configuration
	return {
		ok: true,
		value: {
			version: FORMULA_EXPERIMENT_VERSION,
			id: value.id,
			transform: transform.value,
			configuration: configuration.value,
		},
	}
}
