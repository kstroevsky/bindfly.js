export type RendererKind = 'canvas2d' | 'webgl2' | 'webgpu'
export type RuntimeKind = 'main-thread' | 'worker'

export interface ExperimentCapabilities<State> {
	readonly renderers: readonly RendererKind[]
	readonly runtimes: readonly RuntimeKind[]
	readonly snapshotState: (state: Readonly<State>) => unknown
}
