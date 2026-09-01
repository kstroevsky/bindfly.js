import type { PointBuffer2D, ProximityEdgeBuffer2D, RenderFrame, Renderer, Viewport } from '../../core/index.ts'

export interface FlyingLinesRenderView {
	readonly background: string
	readonly particles: PointBuffer2D
	readonly edges: ProximityEdgeBuffer2D
}

class FlyingLinesCanvasRenderer implements Renderer<FlyingLinesRenderView> {
	private readonly canvas: HTMLCanvasElement
	private readonly context: CanvasRenderingContext2D
	private viewport: Viewport | undefined
	private disposed = false
	private readonly colors: string[] = []

	constructor(canvas: HTMLCanvasElement) {
		const context = canvas.getContext('2d', { alpha: false })
		if (!context) throw new Error('Flying Lines requires a Canvas2D context.')
		this.canvas = canvas
		this.context = context
	}

	resize(viewport: Viewport): void {
		if (this.disposed) throw new Error('Cannot resize a disposed renderer.')
		this.viewport = viewport
		this.canvas.width = viewport.backingWidth
		this.canvas.height = viewport.backingHeight
		this.canvas.style.width = `${viewport.cssWidth}px`
		this.canvas.style.height = `${viewport.cssHeight}px`
		this.context.setTransform(
			viewport.devicePixelRatio,
			0,
			0,
			viewport.devicePixelRatio,
			0,
			0,
		)
	}

	render(state: Readonly<FlyingLinesRenderView>, _frame: RenderFrame): void {
		if (this.disposed) throw new Error('Cannot render with a disposed renderer.')
		if (!this.viewport) throw new Error('Renderer must be resized before its first frame.')

		this.context.fillStyle = state.background
		this.context.fillRect(0, 0, this.viewport.cssWidth, this.viewport.cssHeight)
		this.context.lineWidth = 0.6

		for (let edgeIndex = 0; edgeIndex < state.edges.edgeCount; edgeIndex++) {
			const sourceIndex = state.edges.sourceIndices[edgeIndex] ?? 0
			const targetIndex = state.edges.targetIndices[edgeIndex] ?? 0
			const sourceId = state.particles.ids[sourceIndex] ?? 0
			let color = this.colors[sourceId]
			if (!color) {
				color = `hsl(${(sourceId * 137.508) % 360}, 82%, 68%)`
				this.colors[sourceId] = color
			}
			this.context.strokeStyle = color
			this.context.globalAlpha = state.edges.opacities[edgeIndex] ?? 1
			this.context.beginPath()
			this.context.moveTo(state.particles.x[sourceIndex] ?? 0, state.particles.y[sourceIndex] ?? 0)
			this.context.lineTo(state.particles.x[targetIndex] ?? 0, state.particles.y[targetIndex] ?? 0)
			this.context.stroke()
		}

		this.context.globalAlpha = 1
		this.context.fillStyle = 'rgba(255, 255, 255, 0.72)'
		for (let index = 0; index < state.particles.count; index++) {
			this.context.beginPath()
			this.context.arc(state.particles.x[index] ?? 0, state.particles.y[index] ?? 0, 1.35, 0, Math.PI * 2)
			this.context.fill()
		}
	}

	dispose(): void {
		this.disposed = true
		this.viewport = undefined
		this.canvas.width = 0
		this.canvas.height = 0
	}
}

export const createFlyingLinesCanvasRenderer = (canvas: HTMLCanvasElement): Renderer<FlyingLinesRenderView> =>
	new FlyingLinesCanvasRenderer(canvas)
