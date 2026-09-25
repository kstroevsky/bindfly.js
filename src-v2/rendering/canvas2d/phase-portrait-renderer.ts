import { createPhaseSpaceTransform } from '../../core/index.ts'
import type { RenderFrame, Renderer, Viewport } from '../../core/index.ts'

export interface PhasePortraitTrajectory {
	readonly id: number
	readonly x: number
	readonly y: number
	readonly status: 'active' | 'escaped' | 'invalid'
	readonly trailX: readonly number[]
	readonly trailY: readonly number[]
}

export interface VectorFieldSample {
	readonly x: number
	readonly y: number
	readonly dx: number
	readonly dy: number
}

export interface PhasePortraitRenderView {
	readonly background: string
	readonly domainRadius: number
	readonly title: string
	readonly trajectories: readonly PhasePortraitTrajectory[]
	readonly trajectoryStyle?: 'curve' | 'points'
	readonly field?: readonly VectorFieldSample[]
}

class PhasePortraitCanvasRenderer implements Renderer<PhasePortraitRenderView> {
	private readonly canvas: HTMLCanvasElement | OffscreenCanvas
	private readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
	private viewport: Viewport | undefined
	private disposed = false

	constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
		const context = 'style' in canvas
			? canvas.getContext('2d', { alpha: false })
			: canvas.getContext('2d', { alpha: false })
		if (!context) throw new Error('Phase portrait requires a Canvas2D context.')
		this.canvas = canvas
		this.context = context
	}

	resize(viewport: Viewport): void {
		if (this.disposed) throw new Error('Cannot resize a disposed phase-portrait renderer.')
		this.viewport = viewport
		this.canvas.width = viewport.backingWidth
		this.canvas.height = viewport.backingHeight
		if ('style' in this.canvas) {
			this.canvas.style.width = `${viewport.cssWidth}px`
			this.canvas.style.height = `${viewport.cssHeight}px`
		}
		this.context.setTransform(viewport.devicePixelRatio, 0, 0, viewport.devicePixelRatio, 0, 0)
	}

	render(view: Readonly<PhasePortraitRenderView>, _frame: RenderFrame): void {
		if (this.disposed) throw new Error('Cannot render with a disposed phase-portrait renderer.')
		if (!this.viewport) throw new Error('Phase-portrait renderer must be resized before rendering.')
		const transform = createPhaseSpaceTransform(this.viewport, view.domainRadius)
		this.context.fillStyle = view.background
		this.context.fillRect(0, 0, this.viewport.cssWidth, this.viewport.cssHeight)

		this.context.strokeStyle = 'rgba(255, 255, 255, 0.16)'
		this.context.lineWidth = 1
		this.context.beginPath()
		const origin = transform.toCanvas({ x: 0, y: 0 })
		this.context.moveTo(origin.x, 0)
		this.context.lineTo(origin.x, this.viewport.cssHeight)
		this.context.moveTo(0, origin.y)
		this.context.lineTo(this.viewport.cssWidth, origin.y)
		this.context.stroke()

		if (view.field) {
			const cell = Math.min(this.viewport.cssWidth, this.viewport.cssHeight) / Math.max(7, Math.sqrt(view.field.length))
			for (const sample of view.field) {
				const magnitude = Math.hypot(sample.dx, sample.dy)
				if (!Number.isFinite(magnitude) || magnitude <= 1e-12) continue
				const canvasPoint = transform.toCanvas(sample)
				const x = canvasPoint.x
				const y = canvasPoint.y
				const length = cell * 0.32 * Math.tanh(magnitude)
				const ux = sample.dx / magnitude
				const uy = sample.dy / magnitude
				this.context.strokeStyle = 'rgba(103, 232, 249, 0.34)'
				this.context.lineWidth = 0.75
				this.context.beginPath()
				this.context.moveTo(x - ux * length * 0.5, y + uy * length * 0.5)
				this.context.lineTo(x + ux * length * 0.5, y - uy * length * 0.5)
				this.context.stroke()
			}
		}

		for (const trajectory of view.trajectories) {
			const hue = (trajectory.id * 137.508 + 190) % 360
			if (view.trajectoryStyle === 'points') {
				this.context.fillStyle = `hsla(${hue}, 84%, 70%, 0.72)`
				for (let index = 0; index < trajectory.trailX.length; index++) {
					const point = transform.toCanvas({ x: trajectory.trailX[index] ?? 0, y: trajectory.trailY[index] ?? 0 })
					const { x, y } = point
					this.context.beginPath()
					this.context.arc(x, y, 1.35, 0, Math.PI * 2)
					this.context.fill()
				}
			} else {
				this.context.strokeStyle = `hsla(${hue}, 84%, 70%, 0.9)`
				this.context.lineWidth = 1.35
				this.context.beginPath()
				for (let index = 0; index < trajectory.trailX.length; index++) {
					const point = transform.toCanvas({ x: trajectory.trailX[index] ?? 0, y: trajectory.trailY[index] ?? 0 })
					const { x, y } = point
					if (index === 0) this.context.moveTo(x, y)
					else this.context.lineTo(x, y)
				}
				this.context.stroke()
			}
			this.context.fillStyle = trajectory.status === 'active'
				? `hsl(${hue}, 88%, 74%)`
				: trajectory.status === 'escaped' ? 'rgba(251, 191, 36, 0.95)' : 'rgba(248, 113, 113, 0.95)'
			this.context.beginPath()
			const head = transform.toCanvas(trajectory)
			this.context.arc(head.x, head.y, 2.6, 0, Math.PI * 2)
			this.context.fill()
		}

		this.context.fillStyle = 'rgba(255, 255, 255, 0.86)'
		this.context.font = '600 12px ui-sans-serif, system-ui, sans-serif'
		this.context.fillText(view.title, 14, 24)
	}

	dispose(): void {
		this.disposed = true
		this.viewport = undefined
		this.canvas.width = 0
		this.canvas.height = 0
	}
}

export const createPhasePortraitCanvasRenderer = (
	canvas: HTMLCanvasElement | OffscreenCanvas,
): Renderer<PhasePortraitRenderView> => new PhasePortraitCanvasRenderer(canvas)
