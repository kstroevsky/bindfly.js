import type { PointBuffer2D, RenderFrame, Renderer, Viewport, WeightedLineSegmentBuffer2D } from '../../core/index.ts'

export interface DroopingLinesRenderView {
	readonly background: string
	readonly particles: PointBuffer2D
	readonly lines: WeightedLineSegmentBuffer2D
	readonly comparison?: {
		readonly a: { readonly particles: PointBuffer2D; readonly lines: WeightedLineSegmentBuffer2D }
		readonly b: { readonly particles: PointBuffer2D; readonly lines: WeightedLineSegmentBuffer2D }
	}
}

class DroopingLinesCanvasRenderer implements Renderer<DroopingLinesRenderView> {
	private readonly canvas: HTMLCanvasElement | OffscreenCanvas
	private readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
	private readonly colors: string[] = []
	private viewport: Viewport | undefined
	private disposed = false

	constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
		const context = canvas.getContext('2d', { alpha: false })
		if (!context || !('fillRect' in context)) throw new Error('Drooping Lines requires a Canvas2D context.')
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
		this.context.setTransform(viewport.devicePixelRatio, 0, 0, viewport.devicePixelRatio, 0, 0)
	}

	render(state: Readonly<DroopingLinesRenderView>, _frame: RenderFrame): void {
		if (this.disposed) throw new Error('Cannot render with a disposed renderer.')
		if (!this.viewport) throw new Error('Renderer must be resized before its first frame.')
		this.context.fillStyle = state.background
		this.context.fillRect(0, 0, this.viewport.cssWidth, this.viewport.cssHeight)
		if (state.comparison) {
			this.renderComparison(state.comparison)
			return
		}
		this.renderLayer(state.particles, state.lines)
	}

	private renderLayer(particles: PointBuffer2D, lines: WeightedLineSegmentBuffer2D): void {
		this.context.lineWidth = 0.5
		for (let index = 0; index < lines.count; index++) {
			const particleIndex = lines.sourceParticleIndices[index] ?? 0
			const sourceId = particles.ids[particleIndex] ?? 0
			let color = this.colors[sourceId]
			if (!color) {
				color = `hsl(${(sourceId * 137.508 + 42) % 360}, 86%, 66%)`
				this.colors[sourceId] = color
			}
			this.context.strokeStyle = color
			this.context.globalAlpha = lines.opacities[index] ?? 1
			this.context.beginPath()
			this.context.moveTo(lines.sourceX[index] ?? 0, lines.sourceY[index] ?? 0)
			this.context.lineTo(lines.targetX[index] ?? 0, lines.targetY[index] ?? 0)
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

	private renderComparison(comparison: NonNullable<DroopingLinesRenderView['comparison']>): void {
		if (!this.viewport) return
		const paneWidth = this.viewport.cssWidth / 2
		const scale = 0.5
		const offsetY = this.viewport.cssHeight * 0.25
		const renderPane = (
			label: string,
			paneX: number,
			layer: { readonly particles: PointBuffer2D; readonly lines: WeightedLineSegmentBuffer2D },
		) => {
			this.context.save()
			this.context.beginPath()
			this.context.rect(paneX, 0, paneWidth, this.viewport?.cssHeight ?? 0)
			this.context.clip()
			this.context.translate(paneX, offsetY)
			this.context.scale(scale, scale)
			this.renderLayer(layer.particles, layer.lines)
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

export const createDroopingLinesCanvasRenderer = (
	canvas: HTMLCanvasElement | OffscreenCanvas,
): Renderer<DroopingLinesRenderView> => new DroopingLinesCanvasRenderer(canvas)
