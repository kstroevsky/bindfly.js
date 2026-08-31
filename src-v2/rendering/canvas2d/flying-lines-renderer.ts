import type { IdentifiedPoint2D, RenderFrame, Renderer, Viewport, WeightedLineSegment2D } from '../../core/index.ts'

export interface FlyingLinesRenderView {
	readonly background: string
	readonly particles: readonly IdentifiedPoint2D[]
	readonly edges: readonly WeightedLineSegment2D[]
}

class FlyingLinesCanvasRenderer implements Renderer<FlyingLinesRenderView> {
	private readonly canvas: HTMLCanvasElement
	private readonly context: CanvasRenderingContext2D
	private viewport: Viewport | undefined
	private disposed = false

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

		for (const edge of state.edges) {
			this.context.strokeStyle = `hsla(${(edge.sourceId * 137.508) % 360}, 82%, 68%, ${edge.opacity})`
			this.context.beginPath()
			this.context.moveTo(edge.sourceX, edge.sourceY)
			this.context.lineTo(edge.targetX, edge.targetY)
			this.context.stroke()
		}

		this.context.fillStyle = 'rgba(255, 255, 255, 0.72)'
		for (const particle of state.particles) {
			this.context.beginPath()
			this.context.arc(particle.x, particle.y, 1.35, 0, Math.PI * 2)
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
