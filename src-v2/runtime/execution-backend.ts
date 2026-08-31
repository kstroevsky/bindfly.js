import type { ParameterPatch, ParameterSchema, Viewport } from '@bindfly-v2/core'

import type { RuntimeState } from './lifecycle.ts'

export interface ExecutionBackend<Schema extends ParameterSchema, Input> {
	readonly state: RuntimeState
	initialize(): Promise<void>
	start(): Promise<void>
	pause(): Promise<void>
	resume(): Promise<void>
	resize(viewport: Viewport): Promise<void>
	applyInput(input: Input): Promise<void>
	updateParameters(patch: ParameterPatch<Schema>): Promise<void>
	dispose(): Promise<void>
}
