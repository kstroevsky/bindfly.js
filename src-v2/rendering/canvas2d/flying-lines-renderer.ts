import type { PointBuffer2D, ProximityEdgeBuffer2D, RenderFrame, Renderer, Viewport } from '../../core/index.ts'

export interface FlyingLinesRenderView {
	readonly background: string
	readonly particles: PointBuffer2D
	readonly edges: ProximityEdgeBuffer2D
	readonly comparison?: {
		readonly a: { readonly particles: PointBuffer2D; readonly edges: ProximityEdgeBuffer2D }
		readonly b: { readonly particles: PointBuffer2D; readonly edges: ProximityEdgeBuffer2D }
	}
}

class FlyingLinesCanvasRenderer implements Renderer<FlyingLinesRenderView> {
	private readonly canvas: HTMLCanvasElement | OffscreenCanvas
	private readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
	private viewport: Viewport | undefined
	private disposed = false
	private readonly colors: string[] = []

	constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
		const context = 'style' in canvas
			? canvas.getContext('2d', { alpha: false })
			: canvas.getContext('2d', { alpha: false })
		if (!context) throw new Error('Flying Lines requires a Canvas2D context.')
		this.canvas = canvas
		this.context = context
	}

	resize(viewport: Viewport): void {
		if (this.disposed) throw new Error('Cannot resize a disposed renderer.')
		this.viewport = viewport
		this.canvas.width = viewport.backingWidth
		this.canvas.height = viewport.backingHeight
		if ('style' in this.canvas) {
			this.canvas.style.width = `${viewport.cssWidth}px`
			this.canvas.style.height = `${viewport.cssHeight}px`
		}
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
		if (state.comparison) {
			this.renderComparison(state.comparison)
			return
		}
		this.renderLayer(state.particles, state.edges)
	}

	private renderLayer(particles: PointBuffer2D, edges: ProximityEdgeBuffer2D): void {
		this.context.lineWidth = 0.6

		for (let edgeIndex = 0; edgeIndex < edges.edgeCount; edgeIndex++) {
			const sourceIndex = edges.sourceIndices[edgeIndex] ?? 0
			const targetIndex = edges.targetIndices[edgeIndex] ?? 0
			const sourceId = particles.ids[sourceIndex] ?? 0
			let color = this.colors[sourceId]
			if (!color) {
				color = `hsl(${(sourceId * 137.508) % 360}, 82%, 68%)`
				this.colors[sourceId] = color
			}
			this.context.strokeStyle = color
			this.context.globalAlpha = edges.opacities[edgeIndex] ?? 1
			this.context.beginPath()
			this.context.moveTo(particles.x[sourceIndex] ?? 0, particles.y[sourceIndex] ?? 0)
			this.context.lineTo(particles.x[targetIndex] ?? 0, particles.y[targetIndex] ?? 0)
			this.context.stroke()
		}

		this.context.globalAlpha = 1
		this.context.fillStyle = 'rgba(255, 255, 255, 0.72)'
		for (let index = 0; index < particles.count; index++) {
			this.context.beginPath()
			this.context.arc(particles.x[index] ?? 0, particles.y[index] ?? 0, 1.35, 0, Math.PI * 2)
			this.context.fill()
		}
	}

	private renderComparison(comparison: NonNullable<FlyingLinesRenderView['comparison']>): void {
		if (!this.viewport) return
		const paneWidth = this.viewport.cssWidth / 2
		const scale = 0.5
		const offsetY = this.viewport.cssHeight * 0.25
		const renderPane = (
			label: string,
			paneX: number,
			layer: { readonly particles: PointBuffer2D; readonly edges: ProximityEdgeBuffer2D },
		) => {
			this.context.save()
			this.context.beginPath()
			this.context.rect(paneX, 0, paneWidth, this.viewport?.cssHeight ?? 0)
			this.context.clip()
			this.context.translate(paneX, offsetY)
			this.context.scale(scale, scale)
			this.renderLayer(layer.particles, layer.edges)
			this.context.restore()
			this.context.fillStyle = 'rgba(255, 255, 255, 0.82)'
			this.context.font = '600 12px ui-sans-serif, system-ui, sans-serif'
			this.context.fillText(label, paneX + 14, 24)
		}
		renderPane('Formula A', 0, comparison.a)
		renderPane('Formula B', paneWidth, comparison.b)
		this.context.fillStyle = 'rgba(255, 255, 255, 0.18)'
		this.context.fillRect(paneWidth - 0.5, 0, 1, this.viewport.cssHeight)
	}

	dispose(): void {
		this.disposed = true
		this.viewport = undefined
		this.canvas.width = 0
		this.canvas.height = 0
	}
}

export const createFlyingLinesCanvasRenderer = (canvas: HTMLCanvasElement | OffscreenCanvas): Renderer<FlyingLinesRenderView> =>
	new FlyingLinesCanvasRenderer(canvas)
