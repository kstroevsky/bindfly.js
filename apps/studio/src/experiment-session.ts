import type {
	ParameterPatch,
	ParameterSchema,
	ParameterValues,
	RenderFrame,
	SimulationStep,
	Viewport,
} from '../../../src-v2/core/index.ts'
import type { RuntimeFormulaView, RuntimePointCloudCaptureRequest, RuntimePointInspectionRequest } from '../../../src-v2/runtime/protocol.ts'

export interface ExperimentTelemetry {
	readonly points: number
	readonly edges: number
	readonly components: number
	readonly step: number
	readonly frameMs: number
	readonly droppedSteps: number
	readonly searchBackend: 'brute' | 'grid'
}

export interface ExperimentSession<Schema extends ParameterSchema, Input, Snapshot, Telemetry> {
	readonly parameters: ParameterValues<Schema>
	readonly telemetry: Readonly<Telemetry>
	step(step: SimulationStep): void
	render(frame: RenderFrame): Readonly<Telemetry>
	applyInput(input: Input): void
	updateParameters(patch: ParameterPatch<Schema>): void
	resize(viewport: Viewport): void
	reset(): void
	recordDroppedSteps(count: number): void
	snapshot(): Snapshot
	updateFormulaView?(view: RuntimeFormulaView): void
	inspectPoint?(request: RuntimePointInspectionRequest): unknown
	capturePointCloud?(request: RuntimePointCloudCaptureRequest): unknown
	dispose(): void
}
