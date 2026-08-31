export type ParameterInvalidation = 'hot-update' | 'reset-simulation' | 'rebuild-runtime'

interface ParameterDefinitionBase<Kind extends string, Value> {
	readonly kind: Kind
	readonly default: Value
	readonly invalidation: ParameterInvalidation
	readonly units?: string
}

export interface NumberParameterDefinition extends ParameterDefinitionBase<'number', number> {
	readonly min?: number
	readonly max?: number
	readonly step?: number
}

export interface BooleanParameterDefinition extends ParameterDefinitionBase<'boolean', boolean> {}

export interface StringParameterDefinition extends ParameterDefinitionBase<'string', string> {
	readonly maxLength?: number
}

export interface EnumParameterDefinition<Values extends readonly string[] = readonly string[]>
	extends ParameterDefinitionBase<'enum', Values[number]> {
	readonly values: Values
}

export type ParameterDefinition =
	| NumberParameterDefinition
	| BooleanParameterDefinition
	| StringParameterDefinition
	| EnumParameterDefinition

export type ParameterSchema = Readonly<Record<string, ParameterDefinition>>

type ValueForDefinition<Definition> = Definition extends NumberParameterDefinition
	? number
	: Definition extends BooleanParameterDefinition
		? boolean
		: Definition extends StringParameterDefinition
			? string
			: Definition extends EnumParameterDefinition<infer Values>
				? Values[number]
				: never

export type ParameterValues<Schema extends ParameterSchema> = {
	readonly [Key in keyof Schema]: ValueForDefinition<Schema[Key]>
}

export type ParameterPatch<Schema extends ParameterSchema> = Partial<ParameterValues<Schema>>

export type ParameterIssueCode =
	| 'invalid-input'
	| 'unknown-parameter'
	| 'invalid-type'
	| 'below-minimum'
	| 'above-maximum'
	| 'invalid-step'
	| 'invalid-enum-value'
	| 'too-long'

export interface ParameterIssue {
	readonly code: ParameterIssueCode
	readonly message: string
	readonly parameterId: string
}

export type ParameterNormalizationResult<Schema extends ParameterSchema> =
	| { readonly ok: true; readonly value: ParameterValues<Schema> }
	| { readonly ok: false; readonly issues: readonly ParameterIssue[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const issue = (parameterId: string, code: ParameterIssueCode, message: string): ParameterIssue => ({
	code,
	message,
	parameterId,
})

const validateNumber = (parameterId: string, definition: NumberParameterDefinition, value: unknown) => {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return issue(parameterId, 'invalid-type', `Parameter '${parameterId}' must be a finite number.`)
	}

	if (definition.min !== undefined && value < definition.min) {
		return issue(parameterId, 'below-minimum', `Parameter '${parameterId}' must be at least ${definition.min}.`)
	}

	if (definition.max !== undefined && value > definition.max) {
		return issue(parameterId, 'above-maximum', `Parameter '${parameterId}' must be at most ${definition.max}.`)
	}

	if (definition.step !== undefined) {
		const base = definition.min ?? 0
		const stepOffset = (value - base) / definition.step
		const tolerance = Number.EPSILON * Math.max(1, Math.abs(stepOffset)) * 8

		if (Math.abs(stepOffset - Math.round(stepOffset)) > tolerance) {
			return issue(
				parameterId,
				'invalid-step',
				`Parameter '${parameterId}' must align to step ${definition.step} from base ${base}.`,
			)
		}
	}

	return undefined
}

const validateValue = (parameterId: string, definition: ParameterDefinition, value: unknown) => {
	switch (definition.kind) {
		case 'number':
			return validateNumber(parameterId, definition, value)
		case 'boolean':
			return typeof value === 'boolean'
				? undefined
				: issue(parameterId, 'invalid-type', `Parameter '${parameterId}' must be a boolean.`)
		case 'string':
			if (typeof value !== 'string') {
				return issue(parameterId, 'invalid-type', `Parameter '${parameterId}' must be a string.`)
			}
			return definition.maxLength !== undefined && value.length > definition.maxLength
				? issue(parameterId, 'too-long', `Parameter '${parameterId}' exceeds length ${definition.maxLength}.`)
				: undefined
		case 'enum':
			return typeof value === 'string' && definition.values.includes(value)
				? undefined
				: issue(parameterId, 'invalid-enum-value', `Parameter '${parameterId}' is not an allowed enum value.`)
	}
}

export const defineParameterSchema = <const Schema extends ParameterSchema>(schema: Schema): Schema => {
	for (const [parameterId, definition] of Object.entries(schema)) {
		if (definition.kind === 'number') {
			if (definition.step !== undefined && (!Number.isFinite(definition.step) || definition.step <= 0)) {
				throw new Error(`Number parameter '${parameterId}' must declare a positive finite step.`)
			}

			if (definition.min !== undefined && definition.max !== undefined && definition.max < definition.min) {
				throw new Error(`Number parameter '${parameterId}' has max below min.`)
			}
		}

		if (definition.kind === 'enum') {
			if (definition.values.length === 0 || !definition.values.includes(definition.default)) {
				throw new Error(`Enum parameter '${parameterId}' must include its default in non-empty values.`)
			}
		}

		const defaultIssue = validateValue(parameterId, definition, definition.default)
		if (defaultIssue) {
			throw new Error(`Invalid default for parameter '${parameterId}': ${defaultIssue.message}`)
		}
	}

	return schema
}

export const normalizeParameters = <Schema extends ParameterSchema>(
	schema: Schema,
	input: unknown,
): ParameterNormalizationResult<Schema> => {
	if (!isRecord(input)) {
		return {
			ok: false,
			issues: [issue('<input>', 'invalid-input', 'Parameter input must be an object.')],
		}
	}

	const issues: ParameterIssue[] = []
	const normalized: Record<string, unknown> = {}

	for (const parameterId of Object.keys(input)) {
		if (!(parameterId in schema)) {
			issues.push(issue(parameterId, 'unknown-parameter', `Unknown parameter '${parameterId}'.`))
		}
	}

	for (const [parameterId, definition] of Object.entries(schema)) {
		const value = Object.hasOwn(input, parameterId) ? input[parameterId] : definition.default
		const validationIssue = validateValue(parameterId, definition, value)

		if (validationIssue) issues.push(validationIssue)
		else normalized[parameterId] = value
	}

	return issues.length > 0
		? { ok: false, issues }
		: { ok: true, value: normalized as ParameterValues<Schema> }
}
