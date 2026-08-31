import type { AnalyzerDefinition } from './analysis-contract.ts'
import type { ExperimentCapabilities } from './capabilities.ts'
import type { ParameterSchema, ParameterValues } from './parameters.ts'
import type { RandomSource } from './random.ts'
import type { Simulation } from './simulation.ts'
import type { ExperimentStateCodec } from './state-codec.ts'
import type { Viewport } from './viewport.ts'

export interface SimulationEnvironment {
	readonly random: RandomSource
	readonly viewport: Viewport
}

export interface ExperimentPreset<Params> {
	readonly id: string
	readonly name: string
	readonly parameters: Params
}

export interface ExperimentDefinition<
	Schema extends ParameterSchema,
	State,
	Input,
	DurableState,
	SerializedState,
> {
	readonly id: string
	readonly stateVersion: number
	readonly parameters: Schema
	readonly stateCodec: ExperimentStateCodec<DurableState, SerializedState>
	readonly capabilities: ExperimentCapabilities<State>
	readonly analyzers?: readonly AnalyzerDefinition<State, unknown>[]
	readonly presets?: readonly ExperimentPreset<ParameterValues<Schema>>[]
	createSimulation(
		environment: SimulationEnvironment,
		parameters: ParameterValues<Schema>,
	): Simulation<State, Input>
}

export const defineExperiment = <
	Schema extends ParameterSchema,
	State,
	Input,
	DurableState,
	SerializedState,
>(
	definition: ExperimentDefinition<Schema, State, Input, DurableState, SerializedState>,
): ExperimentDefinition<Schema, State, Input, DurableState, SerializedState> => {
	if (definition.id.trim().length === 0) {
		throw new Error('Experiment definition must include a non-empty stable ID.')
	}

	if (!Number.isInteger(definition.stateVersion) || definition.stateVersion <= 0) {
		throw new Error('Experiment stateVersion must be a positive integer.')
	}

	if (definition.stateCodec.currentVersion !== definition.stateVersion) {
		throw new Error(
			`Experiment '${definition.id}' codec version ${definition.stateCodec.currentVersion} `
			+ `does not match stateVersion ${definition.stateVersion}.`,
		)
	}

	const analyzerIds = definition.analyzers?.map(({ id }) => id) ?? []
	if (new Set(analyzerIds).size !== analyzerIds.length) {
		throw new Error(`Experiment '${definition.id}' contains duplicate analyzer IDs.`)
	}

	const presetIds = definition.presets?.map(({ id }) => id) ?? []
	if (new Set(presetIds).size !== presetIds.length) {
		throw new Error(`Experiment '${definition.id}' contains duplicate preset IDs.`)
	}

	return definition
}
