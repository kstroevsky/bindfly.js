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
	readonly simulationMs?: number
	readonly derivationMs?: number
	readonly uploadMs?: number
	readonly renderMs?: number
	readonly totalFrameMs?: number
	readonly droppedSteps: number
	readonly searchBackend: 'brute' | 'grid'
}

export interface Stage15FrameTiming {
	readonly simulationMs: number
	readonly derivationMs: number
	readonly uploadMs: number
	readonly renderMs: number
	readonly totalFrameMs: number
}

export const createStage15FrameTimer = (now: () => number = () => performance.now()) => {
	let simulationMs = 0
	return {
		measureSimulation(run: () => void): void {
			const startedAt = now()
			run()
			simulationMs += now() - startedAt
		},
		measure<T>(run: () => T): { readonly value: T; readonly durationMs: number } {
			const startedAt = now()
			const value = run()
			return { value, durationMs: now() - startedAt }
		},
		finish(derivationMs: number, renderMs: number, uploadMs = 0): Stage15FrameTiming {
			const timing = {
				simulationMs,
				derivationMs,
				uploadMs,
				renderMs,
				totalFrameMs: simulationMs + derivationMs + uploadMs + renderMs,
			}
			simulationMs = 0
			return timing
		},
		reset(): void {
			simulationMs = 0
		},
	}
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
