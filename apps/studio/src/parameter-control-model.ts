import type { ParameterDefinition, ParameterInvalidation, ParameterIssue, ParameterSchema, ParameterValues } from '../../../src-v2/core/parameters.ts'

export interface ParameterControlModel {
	readonly id: string
	readonly label: string
	readonly definition: ParameterDefinition
	readonly value: boolean | number | string
	readonly units?: string
	readonly invalidation: ParameterInvalidation
	readonly error?: string
}

const labelFor = (id: string): string => id
	.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
	.replace(/^./, (character) => character.toUpperCase())

export const createParameterControlModels = <Schema extends ParameterSchema>(
	schema: Schema,
	values: ParameterValues<Schema>,
	issues: readonly ParameterIssue[] = [],
): readonly ParameterControlModel[] => Object.entries(schema).map(([id, definition]) => {
	const error = issues.find(({ parameterId }) => parameterId === id)?.message
	return {
		id,
		label: labelFor(id),
		definition,
		value: values[id] as boolean | number | string,
		...(definition.units ? { units: definition.units } : {}),
		invalidation: definition.invalidation,
		...(error ? { error } : {}),
	}
})
