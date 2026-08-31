import type { Viewport } from './viewport.ts'

export interface RenderFrame {
	readonly frameIndex: number
	readonly simulationStepIndex: number
	readonly interpolationAlpha: number
}

export interface Renderer<State> {
	resize(viewport: Viewport): void
	render(state: Readonly<State>, frame: RenderFrame): void
	dispose(): void
}
