import { normalizeParameters } from '../../../src-v2/core/parameters.ts'
import type { ParameterPatch, ParameterSchema, ParameterValues } from '../../../src-v2/core/parameters.ts'
import type { ExecutionProfile, RendererKind } from '../../../src-v2/core/capabilities.ts'
import type { ExperimentTiming } from '../../../src-v2/core/clock.ts'
import type { ExperimentDefinition } from '../../../src-v2/core/experiment.ts'
import type { Result } from '../../../src-v2/core/result.ts'
import type { RenderFrame, SimulationStep, Viewport } from '../../../src-v2/core/index.ts'
import type { RuntimeFormulaView, RuntimePointCloudCaptureRequest, RuntimePointInspectionRequest } from '../../../src-v2/runtime/protocol.ts'
import type { ExperimentSession, ExperimentTelemetry } from './experiment-session.ts'

export type StudioParameterValue = boolean | number | string
export type StudioParameterValues = Readonly<Record<string, StudioParameterValue>>
export type StudioParameterPatch = Readonly<Record<string, StudioParameterValue>>
export type StudioFormulaView = RuntimeFormulaView
export type StudioTemporalSemantics =
	| { readonly kind: 'static' }
	| { readonly kind: 'continuous'; readonly stepLabel?: string }
	| { readonly kind: 'discrete'; readonly stepLabel?: string }

export interface StudioPointerEvent {
	readonly phase: 'down' | 'move' | 'up' | 'cancel'
	readonly x: number
	readonly y: number
	readonly buttons: number
	readonly shiftKey: boolean
}

export interface StudioInteractionController {
	handle(event: StudioPointerEvent): readonly unknown[]
}

export interface TypedStudioInteractionController<Input> {
	handle(event: StudioPointerEvent): readonly Input[]
}

export interface MetricDescriptor {
	readonly id: string
	readonly label: string
	readonly format?: (value: number | string) => string
}

export interface StudioProvenanceEntry {
	readonly id: string
	readonly format: string
	readonly version: number
	readonly legacyPath: string
	readonly legacyGitBlob: string
	readonly capturedBehavior: string
}

export interface StudioInspectionRow {
	readonly label: string
	readonly value: string
}

export interface StudioInspectionSection {
	readonly title: string
	readonly rows: readonly StudioInspectionRow[]
}

export interface StudioPointInspectionView {
	readonly title: string
	readonly sections: readonly StudioInspectionSection[]
}

export interface ErasedExperimentSession {
	readonly parameters: StudioParameterValues
	readonly telemetry: Readonly<ExperimentTelemetry>
	step(step: SimulationStep): void
	render(frame: RenderFrame): Readonly<ExperimentTelemetry>
	applyInput(input: unknown): void
	updateParameters(patch: StudioParameterPatch): void
	resize(viewport: Viewport): void
	reset(): void
	recordDroppedSteps(count: number): void
	snapshot(): unknown
	updateFormulaView?(view: StudioFormulaView): void
	inspectPoint?(request: RuntimePointInspectionRequest): unknown
	capturePointCloud?(request: RuntimePointCloudCaptureRequest): unknown
	dispose(): void
}

export interface StudioExperimentPlugin {
	readonly id: string
	readonly title: string
	readonly stateVersion: number
	readonly timing: ExperimentTiming
	readonly parameters: ParameterSchema
	readonly defaultParameters: StudioParameterValues
	readonly defaultSeed: string
	readonly executionProfiles: readonly ExecutionProfile[]
	readonly metrics: readonly MetricDescriptor[]
	readonly provenance: readonly StudioProvenanceEntry[]
	readonly pointCloudSources: readonly RuntimePointCloudCaptureRequest['source'][]
	readonly formulaViews: readonly StudioFormulaView[]
	readonly temporalSemantics: StudioTemporalSemantics
	readonly formatPointInspection?: (value: unknown) => StudioPointInspectionView | undefined
	normalizeParameters(value: unknown): Result<StudioParameterValues, string>
	parseInput(value: unknown): Result<unknown, string>
	parseParameterPatch(value: unknown): Result<StudioParameterPatch, string>
	createSession(options: {
		readonly canvas: HTMLCanvasElement | OffscreenCanvas
		readonly rendererId: RendererKind
		readonly parameters: unknown
		readonly formulaView: StudioFormulaView
		readonly seed: string
		readonly viewport: Viewport
		readonly stage15Benchmark?: boolean
	}): ErasedExperimentSession
	createInteractionController(): StudioInteractionController
	serializeConfiguration(parameters: unknown, seed: string): string
	parseConfiguration(payload: string, stateVersion: number): Result<{
		readonly parameters: StudioParameterValues
		readonly seed: string
	}, string>
	migrateLegacyUrl?(url: URL): Result<{
		readonly parameters: StudioParameterValues
		readonly seed: string
	}, string> | undefined
}

export interface DefineStudioExperimentOptions<
	Schema extends ParameterSchema,
	State,
	Input,
	DurableState,
	SnapshotState,
	Telemetry extends ExperimentTelemetry,
> {
	readonly definition: ExperimentDefinition<Schema, State, Input, DurableState, string, SnapshotState>
	readonly title: string
	readonly defaultSeed: string
	readonly provenance?: readonly StudioProvenanceEntry[]
	readonly pointCloudSources?: readonly RuntimePointCloudCaptureRequest['source'][]
	readonly formulaViews?: readonly StudioFormulaView[]
	readonly temporalSemantics?: StudioTemporalSemantics
	readonly formatPointInspection?: (value: unknown) => StudioPointInspectionView | undefined
	readonly metrics: readonly {
		readonly id: keyof Telemetry & string
		readonly label: string
		readonly format?: (value: number | string) => string
	}[]
	createSession(options: {
		readonly canvas: HTMLCanvasElement | OffscreenCanvas
		readonly rendererId: RendererKind
		readonly parameters: ParameterValues<Schema>
		readonly formulaView: StudioFormulaView
		readonly seed: string
		readonly viewport: Viewport
		readonly stage15Benchmark?: boolean
	}): ExperimentSession<Schema, Input, SnapshotState, Telemetry>
	createInteractionController(): TypedStudioInteractionController<Input>
	parseInput(value: unknown): Result<Input, string>
	validateParameters?(parameters: ParameterValues<Schema>): Result<unknown, string>
	toDurableState(parameters: ParameterValues<Schema>, seed: string): DurableState
	fromDurableState(state: DurableState): {
		readonly parameters: ParameterValues<Schema>
		readonly seed: string
	}
	migrateLegacyUrl?(url: URL): Result<{
		readonly parameters: ParameterValues<Schema>
		readonly seed: string
	}, string> | undefined
}

const firstParameterIssue = (issues: readonly { readonly message: string }[]) =>
	issues[0]?.message ?? 'Experiment parameters are invalid.'

export const defineStudioExperiment = <
	Schema extends ParameterSchema,
	State,
	Input,
	DurableState,
	SnapshotState,
	Telemetry extends ExperimentTelemetry,
>(options: DefineStudioExperimentOptions<Schema, State, Input, DurableState, SnapshotState, Telemetry>): StudioExperimentPlugin => {
	const definition = options.definition
	const normalize = (input: unknown): Result<ParameterValues<Schema>, string> => {
		const result = normalizeParameters(definition.parameters, input)
		if (!result.ok) return { ok: false, error: firstParameterIssue(result.issues) }
		const validated = options.validateParameters?.(result.value)
		return validated && !validated.ok ? validated : result
	}
	const defaults = normalize({})
	if (!defaults.ok) throw new Error(`Experiment '${definition.id}' has invalid defaults: ${defaults.error}`)

	return {
		id: definition.id,
		title: options.title,
		stateVersion: definition.stateVersion,
		timing: definition.timing,
		parameters: definition.parameters,
		defaultParameters: defaults.value as StudioParameterValues,
		defaultSeed: options.defaultSeed,
		executionProfiles: definition.capabilities.executionProfiles,
		metrics: options.metrics,
		provenance: Object.freeze((options.provenance ?? []).map((entry) => Object.freeze({ ...entry }))),
		pointCloudSources: Object.freeze([...(options.pointCloudSources ?? [])]),
		formulaViews: Object.freeze([...(options.formulaViews ?? ['morph'])]),
		temporalSemantics: Object.freeze(options.temporalSemantics ?? { kind: 'continuous' }),
		...(options.formatPointInspection ? { formatPointInspection: options.formatPointInspection } : {}),
		normalizeParameters: (value) => {
			const result = normalize(value)
			return result.ok
				? { ok: true, value: result.value as StudioParameterValues }
				: result
		},
		parseInput: (value) => options.parseInput(value),
		parseParameterPatch: (value) => {
			if (typeof value !== 'object' || value === null || Array.isArray(value)) {
				return { ok: false, error: 'Parameter patch must be an object.' }
			}
			const record = value as Record<string, unknown>
			const normalized = normalize(record)
			if (!normalized.ok) return normalized
			return {
				ok: true,
				value: Object.fromEntries(Object.keys(record).map((parameterId) => [
					parameterId,
					normalized.value[parameterId],
				])) as StudioParameterPatch,
			}
		},
		createSession: (sessionOptions) => {
			const parameters = normalize(sessionOptions.parameters)
			if (!parameters.ok) throw new Error(parameters.error)
			const session = options.createSession({ ...sessionOptions, parameters: parameters.value })
			return {
				get parameters() { return session.parameters as StudioParameterValues },
				get telemetry() { return session.telemetry },
				step: (step) => session.step(step),
				render: (frame) => session.render(frame),
				applyInput: (input) => {
					const parsed = options.parseInput(input)
					if (!parsed.ok) throw new Error(parsed.error)
					session.applyInput(parsed.value)
				},
				updateParameters: (patch) => {
					const parsed = options.definition.parameters
					const normalized = normalizeParameters(parsed, patch)
					if (!normalized.ok) throw new Error(firstParameterIssue(normalized.issues))
					session.updateParameters(patch as ParameterPatch<Schema>)
				},
				resize: (viewport) => session.resize(viewport),
				reset: () => session.reset(),
				recordDroppedSteps: (count) => session.recordDroppedSteps(count),
				snapshot: () => session.snapshot(),
				...(session.updateFormulaView ? { updateFormulaView: (view: StudioFormulaView) => session.updateFormulaView?.(view) } : {}),
				...(session.inspectPoint ? { inspectPoint: (request: RuntimePointInspectionRequest) => session.inspectPoint?.(request) } : {}),
				...(session.capturePointCloud ? { capturePointCloud: (request: RuntimePointCloudCaptureRequest) => session.capturePointCloud?.(request) } : {}),
				dispose: () => session.dispose(),
			}
		},
		createInteractionController: () => {
			const controller = options.createInteractionController()
			return { handle: (event) => controller.handle(event) }
		},
		serializeConfiguration: (parameters, seed) => {
			const normalized = normalize(parameters)
			if (!normalized.ok) throw new Error(normalized.error)
			return definition.stateCodec.serialize(options.toDurableState(normalized.value, seed))
		},
		parseConfiguration: (payload, stateVersion) => {
			if (stateVersion > definition.stateVersion) {
				return { ok: false, error: `Experiment state version ${stateVersion} is newer than supported version ${definition.stateVersion}.` }
			}
			const migrated = stateVersion < definition.stateVersion
				? definition.stateCodec.migrate(payload, {
					experimentId: definition.id,
					fromVersion: stateVersion,
					toVersion: definition.stateVersion,
				})
				: { ok: true as const, value: payload }
			if (!migrated.ok) return migrated
			const parsed = definition.stateCodec.parse(migrated.value)
			if (!parsed.ok) return parsed
			const configuration = options.fromDurableState(parsed.value)
			return {
				ok: true,
				value: {
					parameters: configuration.parameters as StudioParameterValues,
					seed: configuration.seed,
				},
			}
		},
		...(options.migrateLegacyUrl
			? {
				migrateLegacyUrl: (url: URL) => {
					const migrated = options.migrateLegacyUrl?.(url)
					if (!migrated || !migrated.ok) return migrated
					return {
						ok: true as const,
						value: {
							parameters: migrated.value.parameters as StudioParameterValues,
							seed: migrated.value.seed,
						},
					}
				},
			}
			: {}),
	}
}
