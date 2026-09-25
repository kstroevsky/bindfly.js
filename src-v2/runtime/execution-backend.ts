import type { ParameterPatch, ParameterSchema, Viewport } from '@bindfly-v2/core'

import type { RuntimeState } from './lifecycle.ts'
import type { RuntimeFormulaView, RuntimePointCloudCaptureRequest, RuntimePointInspectionRequest } from './protocol.ts'

export interface ExecutionBackend<Schema extends ParameterSchema, Input> {
	readonly state: RuntimeState
	initialize(): Promise<void>
	start(): Promise<void>
	pause(): Promise<void>
	resume(): Promise<void>
	step(): Promise<void>
	updateFormulaView(view: RuntimeFormulaView): Promise<void>
	inspectPoint(request: RuntimePointInspectionRequest): Promise<unknown>
	capturePointCloud(request: RuntimePointCloudCaptureRequest): Promise<unknown>
	resize(viewport: Viewport): Promise<void>
	applyInput(input: Input): Promise<void>
	updateParameters(patch: ParameterPatch<Schema>): Promise<void>
	reset(): Promise<void>
	dispose(): Promise<void>
}
