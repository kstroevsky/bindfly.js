import type { PointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import type { RipsComplexResult } from '../../../src-v2/analysis/rips-complex.ts'
import type { RendererKind } from '../../../src-v2/core/capabilities.ts'
import type { ExperimentTelemetry } from './experiment-session.ts'
import type { StudioRuntimeKind } from './studio-controller.ts'

export interface StudioPerformanceSnapshot {
	readonly fps: number
	readonly renderer: RendererKind
	readonly runtime: StudioRuntimeKind
	readonly dpr: number
	readonly frameMs: number
	readonly simulationMs?: number
	readonly derivationMs?: number
	readonly uploadMs?: number
	readonly renderMs?: number
	readonly gpuRenderMs?: number
	readonly analysisMs?: number
	readonly analysisBufferBytes?: number
}

export const estimateAnalysisBufferBytes = (
	snapshot: PointCloudSnapshot | undefined,
	result: RipsComplexResult | undefined,
): number | undefined => {
	if (!snapshot && !result) return undefined
	let bytes = 0
	if (snapshot) bytes += snapshot.ids.byteLength + snapshot.x.byteLength + snapshot.y.byteLength
	if (result) {
		bytes += result.edgeSourceIndices.byteLength + result.edgeTargetIndices.byteLength + result.edgeBirths.byteLength
		bytes += result.triangles.a.byteLength + result.triangles.b.byteLength
			+ result.triangles.c.byteLength + result.triangles.births.byteLength
	}
	return bytes
}

export const createStudioPerformanceSnapshot = (options: {
	readonly telemetry: ExperimentTelemetry
	readonly renderer: RendererKind
	readonly runtime: StudioRuntimeKind
	readonly dpr: number
	readonly analysisMs?: number
	readonly analysisSnapshot?: PointCloudSnapshot
	readonly analysisResult?: RipsComplexResult
}): StudioPerformanceSnapshot => {
	const frameMs = options.telemetry.totalFrameMs ?? options.telemetry.frameMs
	const fps = frameMs > 0 ? 1000 / frameMs : 0
	const analysisBufferBytes = estimateAnalysisBufferBytes(options.analysisSnapshot, options.analysisResult)
	return Object.freeze({
		fps,
		renderer: options.renderer,
		runtime: options.runtime,
		dpr: options.dpr,
		frameMs,
		...(options.telemetry.simulationMs === undefined ? {} : { simulationMs: options.telemetry.simulationMs }),
		...(options.telemetry.derivationMs === undefined ? {} : { derivationMs: options.telemetry.derivationMs }),
		...(options.telemetry.uploadMs === undefined ? {} : { uploadMs: options.telemetry.uploadMs }),
		...(options.telemetry.renderMs === undefined ? {} : { renderMs: options.telemetry.renderMs }),
		...(options.telemetry.gpuRenderMs === undefined ? {} : { gpuRenderMs: options.telemetry.gpuRenderMs }),
		...(options.analysisMs === undefined ? {} : { analysisMs: options.analysisMs }),
		...(analysisBufferBytes === undefined
			? {}
			: { analysisBufferBytes }),
	})
}
