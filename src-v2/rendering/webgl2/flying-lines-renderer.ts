import type { RenderFrame, Renderer, RendererFrameTiming, Viewport } from '../../core/index.ts'
import type { FlyingLinesRenderView } from '../flying-lines.ts'
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

class FlyingLinesWebGL2Renderer implements Renderer<FlyingLinesRenderView> {
	private readonly canvas: HTMLCanvasElement
	private readonly gl: WebGL2RenderingContext
	private viewport: Viewport | undefined
	private primitives: ColoredPrimitiveProgram | undefined
	private edgeBuffer: WebGLBuffer | undefined
	private pointBuffer: WebGLBuffer | undefined
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
		this.primitives = new ColoredPrimitiveProgram(this.gl)
		this.edgeBuffer = this.primitives.createBuffer()
		this.pointBuffer = this.primitives.createBuffer()
	}

	resize(viewport: Viewport): void {
		if (this.disposed) throw new Error('Cannot resize a disposed Flying Lines WebGL2 renderer.')
		this.viewport = viewport
		if (!this.contextLost) resizeWebGLCanvas(this.canvas, this.gl, viewport)
	}

	render(view: Readonly<FlyingLinesRenderView>, _frame: RenderFrame): RendererFrameTiming {
		if (this.disposed) throw new Error('Cannot render with a disposed Flying Lines WebGL2 renderer.')
		if (!this.viewport) throw new Error('Flying Lines WebGL2 renderer must be resized before rendering.')
		if (this.contextLost) return { uploadMs: 0, renderMs: 0 }
		if (view.comparison || view.difference) throw new Error('WebGL2 parity currently supports the single Flying Lines view only.')
		const primitives = this.primitives
		const edgeBuffer = this.edgeBuffer
		const pointBuffer = this.pointBuffer
		if (!primitives || !edgeBuffer || !pointBuffer) throw new Error('Flying Lines WebGL2 resources are unavailable.')

		const uploadStarted = performance.now()
		const edgeVertices: number[] = []
		for (let edgeIndex = 0; edgeIndex < view.edges.edgeCount; edgeIndex++) {
			const sourceIndex = view.edges.sourceIndices[edgeIndex] ?? 0
			const targetIndex = view.edges.targetIndices[edgeIndex] ?? 0
			const sourceId = view.particles.ids[sourceIndex] ?? 0
			const color = hslToNormalizedRgba((sourceId * 137.508) % 360, 0.82, 0.68, view.edges.opacities[edgeIndex] ?? 1)
			appendColoredVertex(edgeVertices, view.particles.x[sourceIndex] ?? 0, view.particles.y[sourceIndex] ?? 0, color)
			appendColoredVertex(edgeVertices, view.particles.x[targetIndex] ?? 0, view.particles.y[targetIndex] ?? 0, color)
		}
		const pointVertices: number[] = []
		const pointColor = [1, 1, 1, 0.72] as const
		for (let index = 0; index < view.particles.count; index++) {
			appendColoredVertex(pointVertices, view.particles.x[index] ?? 0, view.particles.y[index] ?? 0, pointColor)
		}
		primitives.upload(edgeBuffer, new Float32Array(edgeVertices))
		primitives.upload(pointBuffer, new Float32Array(pointVertices))
		const uploadMs = performance.now() - uploadStarted

		const gpuRenderMs = this.gpuTimer?.poll()
		const renderStarted = performance.now()
		this.gpuTimer?.begin()
		const background = parseCssColorRgba(view.background)
		this.gl.clearColor(background[0], background[1], background[2], background[3])
		this.gl.clear(this.gl.COLOR_BUFFER_BIT)
		primitives.draw(edgeBuffer, this.gl.LINES, edgeVertices.length / 6, this.viewport)
		primitives.draw(pointBuffer, this.gl.POINTS, pointVertices.length / 6, this.viewport, 2.7, true)
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
		this.primitives?.disposeBuffer(this.edgeBuffer)
		this.primitives?.disposeBuffer(this.pointBuffer)
		this.primitives?.dispose()
		this.gpuTimer?.dispose()
		this.edgeBuffer = undefined
		this.pointBuffer = undefined
		this.primitives = undefined
		this.gpuTimer = undefined
		this.viewport = undefined
		this.canvas.width = 0
		this.canvas.height = 0
	}
}

export const createFlyingLinesWebGL2Renderer = (canvas: HTMLCanvasElement): Renderer<FlyingLinesRenderView> =>
	new FlyingLinesWebGL2Renderer(canvas)
