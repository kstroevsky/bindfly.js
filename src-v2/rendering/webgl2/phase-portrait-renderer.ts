import { createPhaseSpaceTransform } from '../../core/index.ts'
import type { RenderFrame, Renderer, RendererFrameTiming, Viewport } from '../../core/index.ts'
import type { PhasePortraitRenderView } from '../phase-portrait.ts'
import {
	appendColoredVertex,
	ColoredPrimitiveProgram,
	createWebGL2Context,
	hslToNormalizedRgba,
	installWebGL2ContextLifecycle,
	parseCssColorRgba,
	resizeWebGLCanvas,
	WebGL2GpuTimer,
} from './common.ts'

interface PrimitiveBuffers {
	readonly lines: WebGLBuffer
	readonly trailPoints: WebGLBuffer
	readonly heads: WebGLBuffer
}

class PhasePortraitWebGL2Renderer implements Renderer<PhasePortraitRenderView> {
	private readonly canvas: HTMLCanvasElement
	private readonly gl: WebGL2RenderingContext
	private viewport: Viewport | undefined
	private primitives: ColoredPrimitiveProgram | undefined
	private buffers: PrimitiveBuffers | undefined
	private gpuTimer: WebGL2GpuTimer | undefined
	private contextLost = false
	private disposed = false
	private readonly removeLifecycle: () => void

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas
		this.gl = createWebGL2Context(canvas)
		this.initializeResources()
		this.removeLifecycle = installWebGL2ContextLifecycle(canvas, {
			lost: () => { this.contextLost = true },
			restored: () => {
				if (this.disposed) return
				this.contextLost = false
				this.initializeResources()
				if (this.viewport) resizeWebGLCanvas(this.canvas, this.gl, this.viewport)
			},
		})
	}

	private initializeResources(): void {
		this.gpuTimer?.dispose()
		this.gpuTimer = new WebGL2GpuTimer(this.gl)
		this.primitives?.dispose()
		const primitives = new ColoredPrimitiveProgram(this.gl)
		this.primitives = primitives
		this.buffers = {
			lines: primitives.createBuffer(),
			trailPoints: primitives.createBuffer(),
			heads: primitives.createBuffer(),
		}
	}

	resize(viewport: Viewport): void {
		if (this.disposed) throw new Error('Cannot resize a disposed phase-portrait WebGL2 renderer.')
		this.viewport = viewport
		if (!this.contextLost) resizeWebGLCanvas(this.canvas, this.gl, viewport)
	}

	render(view: Readonly<PhasePortraitRenderView>, _frame: RenderFrame): RendererFrameTiming {
		if (this.disposed) throw new Error('Cannot render with a disposed phase-portrait WebGL2 renderer.')
		if (!this.viewport) throw new Error('Phase-portrait WebGL2 renderer must be resized before rendering.')
		if (this.contextLost) return { uploadMs: 0, renderMs: 0 }
		const primitives = this.primitives
		const buffers = this.buffers
		if (!primitives || !buffers) throw new Error('Phase-portrait WebGL2 resources are unavailable.')
		const transform = createPhaseSpaceTransform(this.viewport, view.domainRadius)

		const uploadStarted = performance.now()
		const lines: number[] = []
		const trailPoints: number[] = []
		const heads: number[] = []
		const axisColor = [1, 1, 1, 0.16] as const
		const origin = transform.toCanvas({ x: 0, y: 0 })
		appendColoredVertex(lines, origin.x, 0, axisColor)
		appendColoredVertex(lines, origin.x, this.viewport.cssHeight, axisColor)
		appendColoredVertex(lines, 0, origin.y, axisColor)
		appendColoredVertex(lines, this.viewport.cssWidth, origin.y, axisColor)

		if (view.field) {
			const fieldColor = [103 / 255, 232 / 255, 249 / 255, 0.34] as const
			const cell = Math.min(this.viewport.cssWidth, this.viewport.cssHeight) / Math.max(7, Math.sqrt(view.field.length))
			for (const sample of view.field) {
				const magnitude = Math.hypot(sample.dx, sample.dy)
				if (!Number.isFinite(magnitude) || magnitude <= 1e-12) continue
				const point = transform.toCanvas(sample)
				const length = cell * 0.32 * Math.tanh(magnitude)
				const ux = sample.dx / magnitude
				const uy = sample.dy / magnitude
				appendColoredVertex(lines, point.x - ux * length * 0.5, point.y + uy * length * 0.5, fieldColor)
				appendColoredVertex(lines, point.x + ux * length * 0.5, point.y - uy * length * 0.5, fieldColor)
			}
		}

		for (const trajectory of view.trajectories) {
			const hue = (trajectory.id * 137.508 + 190) % 360
			const trailColor = hslToNormalizedRgba(hue, 0.84, 0.70, view.trajectoryStyle === 'points' ? 0.72 : 0.9)
			if (view.trajectoryStyle === 'points') {
				for (let index = 0; index < trajectory.trailX.length; index++) {
					const point = transform.toCanvas({ x: trajectory.trailX[index] ?? 0, y: trajectory.trailY[index] ?? 0 })
					appendColoredVertex(trailPoints, point.x, point.y, trailColor)
				}
			} else {
				for (let index = 1; index < trajectory.trailX.length; index++) {
					if (trajectory.trailEpochs?.[index] !== trajectory.trailEpochs?.[index - 1]) continue
					const previous = transform.toCanvas({ x: trajectory.trailX[index - 1] ?? 0, y: trajectory.trailY[index - 1] ?? 0 })
					const current = transform.toCanvas({ x: trajectory.trailX[index] ?? 0, y: trajectory.trailY[index] ?? 0 })
					appendColoredVertex(lines, previous.x, previous.y, trailColor)
					appendColoredVertex(lines, current.x, current.y, trailColor)
				}
			}
			const headColor = trajectory.status === 'active'
				? hslToNormalizedRgba(hue, 0.88, 0.74)
				: trajectory.status === 'escaped'
					? [251 / 255, 191 / 255, 36 / 255, 0.95] as const
					: [248 / 255, 113 / 255, 113 / 255, 0.95] as const
			const head = transform.toCanvas(trajectory)
			appendColoredVertex(heads, head.x, head.y, headColor)
		}

		const lineVertices = new Float32Array(lines)
		const trailPointVertices = new Float32Array(trailPoints)
		const headVertices = new Float32Array(heads)
		primitives.upload(buffers.lines, lineVertices)
		primitives.upload(buffers.trailPoints, trailPointVertices)
		primitives.upload(buffers.heads, headVertices)
		const uploadMs = performance.now() - uploadStarted

		const gpuRenderMs = this.gpuTimer?.poll()
		const renderStarted = performance.now()
		this.gpuTimer?.begin()
		const background = parseCssColorRgba(view.background)
		this.gl.clearColor(background[0], background[1], background[2], background[3])
		this.gl.clear(this.gl.COLOR_BUFFER_BIT)
		primitives.draw(buffers.lines, this.gl.LINES, lineVertices.length / 6, this.viewport)
		primitives.draw(buffers.trailPoints, this.gl.POINTS, trailPointVertices.length / 6, this.viewport, 2.7, true)
		primitives.draw(buffers.heads, this.gl.POINTS, headVertices.length / 6, this.viewport, 5.2, true)
		this.gpuTimer?.end()
		return {
			uploadMs,
			renderMs: performance.now() - renderStarted,
			...(gpuRenderMs === undefined ? {} : { gpuRenderMs }),
		}
	}

	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		this.removeLifecycle()
		if (this.primitives && this.buffers) {
			this.primitives.disposeBuffer(this.buffers.lines)
			this.primitives.disposeBuffer(this.buffers.trailPoints)
			this.primitives.disposeBuffer(this.buffers.heads)
		}
		this.primitives?.dispose()
		this.gpuTimer?.dispose()
		this.primitives = undefined
		this.buffers = undefined
		this.gpuTimer = undefined
		this.viewport = undefined
		this.canvas.width = 0
		this.canvas.height = 0
	}
}

export const createPhasePortraitWebGL2Renderer = (canvas: HTMLCanvasElement): Renderer<PhasePortraitRenderView> =>
	new PhasePortraitWebGL2Renderer(canvas)
