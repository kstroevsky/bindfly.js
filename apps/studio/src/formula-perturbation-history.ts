import type { ParameterSchema } from '../../../src-v2/core/parameters.ts'
import type { StudioParameterValues } from './studio-experiment-plugin.ts'

export interface FormulaPerturbationMetrics {
	readonly step: number
	readonly points: number
	readonly edges: number
	readonly components: number
}

export interface FormulaPerturbationNode {
	readonly id: string
	readonly label: string
	readonly simulationSnapshotId: string
	readonly configuration: Readonly<Record<string, unknown>>
	readonly metrics: FormulaPerturbationMetrics
}

export const MAX_FORMULA_PERTURBATION_HISTORY = 12

export const extractFormulaConfiguration = (
	schema: ParameterSchema,
	values: StudioParameterValues,
): Readonly<Record<string, unknown>> => {
	const configuration: Record<string, unknown> = {}
	for (const [parameterId, definition] of Object.entries(schema)) {
		const isFormulaSource = definition.kind === 'string' && definition.control === 'formula'
		const isFormulaControl = parameterId === 'formulaMorph'
			|| definition.kind === 'number' && definition.semantic === 'formula-parameter'
		if (isFormulaSource || isFormulaControl) configuration[parameterId] = values[parameterId]
	}
	return Object.freeze(configuration)
}

export const createFormulaPerturbationNode = (input: {
	readonly id: string
	readonly label: string
	readonly simulationSnapshotId: string
	readonly schema: ParameterSchema
	readonly parameters: StudioParameterValues
	readonly metrics: FormulaPerturbationMetrics
}): FormulaPerturbationNode => Object.freeze({
	id: input.id,
	label: input.label,
	simulationSnapshotId: input.simulationSnapshotId,
	configuration: extractFormulaConfiguration(input.schema, input.parameters),
	metrics: Object.freeze({ ...input.metrics }),
})

export const appendFormulaPerturbation = (
	history: readonly FormulaPerturbationNode[],
	node: FormulaPerturbationNode,
	limit = MAX_FORMULA_PERTURBATION_HISTORY,
): readonly FormulaPerturbationNode[] => {
	if (!Number.isInteger(limit) || limit <= 0) throw new RangeError('Formula history limit must be a positive integer.')
	return Object.freeze([...history, node].slice(-limit))
}
