export type RendererKind = 'canvas2d' | 'webgl2' | 'webgpu'
export type RuntimeKind = 'main-thread' | 'worker'

export interface ExecutionProfile {
	readonly rendererId: RendererKind
	readonly runtimeId: RuntimeKind
}

export interface ExperimentCapabilities<State, SnapshotState> {
	readonly executionProfiles: readonly ExecutionProfile[]
	readonly snapshotState: (state: Readonly<State>) => SnapshotState
}
