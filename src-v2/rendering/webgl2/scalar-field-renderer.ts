import { createPhaseSpaceTransform } from '../../core/index.ts'
import type { RenderFrame, Renderer, RendererFrameTiming, Viewport } from '../../core/index.ts'
import { createScalarFieldRaster, extractScalarFieldContourSegments } from '../scalar-field.ts'
import type { ScalarFieldRenderGrid, ScalarFieldRenderView } from '../scalar-field.ts'
import {
	appendColoredVertex,
	ColoredPrimitiveProgram,
	createWebGL2Context,
	createWebGL2Program,
	installWebGL2ContextLifecycle,
	parseCssColorRgba,
	resizeWebGLCanvas,
} from './common.ts'

const TEXTURE_VERTEX_SHADER = `#version 300 es
out vec2 vUv;
void main() {
  vec2 positions[4] = vec2[4](vec2(-1.0,-1.0), vec2(1.0,-1.0), vec2(-1.0,1.0), vec2(1.0,1.0));
  vec2 uvs[4] = vec2[4](vec2(0.0,1.0), vec2(1.0,1.0), vec2(0.0,0.0), vec2(1.0,0.0));
  gl_Position = vec4(positions[gl_VertexID], 0.0, 1.0);
  vUv = uvs[gl_VertexID];
}`

const TEXTURE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
out vec4 outColor;
void main() { outColor = texture(uTexture, vUv); }`

class ScalarFieldWebGL2Renderer implements Renderer<ScalarFieldRenderView> {
	private readonly canvas: HTMLCanvasElement
	private readonly gl: WebGL2RenderingContext
	private viewport: Viewport | undefined
	private textureProgram: WebGLProgram | undefined
	private texture: WebGLTexture | undefined
	private primitives: ColoredPrimitiveProgram | undefined
	private contourBuffer: WebGLBuffer | undefined
	private axisBuffer: WebGLBuffer | undefined
	private rasterGrid: ScalarFieldRenderGrid | undefined
	private rasterScale: number | undefined
	private contourGrid: ScalarFieldRenderGrid | undefined
	private contourLevel: number | undefined
	private contourViewport: Viewport | undefined
	private contourVertexCount = 0
	private axisRadius: number | undefined
	private axisViewport: Viewport | undefined
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
				this.invalidateCaches()
				if (this.viewport) resizeWebGLCanvas(this.canvas, this.gl, this.viewport)
			},
		})
	}

	private initializeResources(): void {
		this.textureProgram = createWebGL2Program(this.gl, TEXTURE_VERTEX_SHADER, TEXTURE_FRAGMENT_SHADER)
		this.texture = this.gl.createTexture() ?? undefined
		if (!this.texture) throw new Error('Unable to allocate a scalar-field WebGL2 texture.')
		this.primitives = new ColoredPrimitiveProgram(this.gl)
		this.contourBuffer = this.primitives.createBuffer()
		this.axisBuffer = this.primitives.createBuffer()
	}

	private invalidateCaches(): void {
		this.rasterGrid = undefined
		this.rasterScale = undefined
		this.contourGrid = undefined
		this.contourLevel = undefined
		this.contourViewport = undefined
		this.axisRadius = undefined
		this.axisViewport = undefined
	}

	resize(viewport: Viewport): void {
		if (this.disposed) throw new Error('Cannot resize a disposed scalar-field WebGL2 renderer.')
		this.viewport = viewport
		this.contourViewport = undefined
		this.axisViewport = undefined
		if (!this.contextLost) resizeWebGLCanvas(this.canvas, this.gl, viewport)
	}

	private uploadRaster(view: Readonly<ScalarFieldRenderView>): void {
		if (this.rasterGrid === view.grid && this.rasterScale === view.valueScale) return
		const raster = createScalarFieldRaster(view.grid, view.valueScale)
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture ?? null)
		this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1)
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
		this.gl.texImage2D(
			this.gl.TEXTURE_2D,
			0,
			this.gl.RGBA,
			raster.width,
			raster.height,
			0,
			this.gl.RGBA,
			this.gl.UNSIGNED_BYTE,
			raster.rgba,
		)
		this.rasterGrid = view.grid
		this.rasterScale = view.valueScale
	}

	private uploadContours(view: Readonly<ScalarFieldRenderView>): void {
		if (this.contourGrid === view.grid && this.contourLevel === view.contourLevel && this.contourViewport === this.viewport) return
		if (!this.viewport || !this.primitives || !this.contourBuffer) return
		const transform = createPhaseSpaceTransform(this.viewport, view.domainRadius)
		const vertices: number[] = []
		const color = [1, 1, 1, 0.9] as const
		for (const segment of extractScalarFieldContourSegments(view.grid, view.contourLevel)) {
			const start = transform.toCanvas(segment.start)
			const end = transform.toCanvas(segment.end)
			appendColoredVertex(vertices, start.x, start.y, color)
			appendColoredVertex(vertices, end.x, end.y, color)
		}
		const data = new Float32Array(vertices)
		this.primitives.upload(this.contourBuffer, data)
		this.contourVertexCount = data.length / 6
		this.contourGrid = view.grid
		this.contourLevel = view.contourLevel
		this.contourViewport = this.viewport
	}

	private uploadAxes(view: Readonly<ScalarFieldRenderView>): void {
		if (this.axisRadius === view.domainRadius && this.axisViewport === this.viewport) return
		if (!this.viewport || !this.primitives || !this.axisBuffer) return
		const transform = createPhaseSpaceTransform(this.viewport, view.domainRadius)
		const origin = transform.toCanvas({ x: 0, y: 0 })
		const color = [1, 1, 1, 0.16] as const
		const vertices: number[] = []
		appendColoredVertex(vertices, origin.x, 0, color)
		appendColoredVertex(vertices, origin.x, this.viewport.cssHeight, color)
		appendColoredVertex(vertices, 0, origin.y, color)
		appendColoredVertex(vertices, this.viewport.cssWidth, origin.y, color)
		this.primitives.upload(this.axisBuffer, new Float32Array(vertices))
		this.axisRadius = view.domainRadius
		this.axisViewport = this.viewport
	}

	render(view: Readonly<ScalarFieldRenderView>, _frame: RenderFrame): RendererFrameTiming {
		if (this.disposed) throw new Error('Cannot render with a disposed scalar-field WebGL2 renderer.')
		if (!this.viewport) throw new Error('Scalar-field WebGL2 renderer must be resized before rendering.')
		if (this.contextLost) return { uploadMs: 0, renderMs: 0 }
		if (!this.textureProgram || !this.texture || !this.primitives || !this.contourBuffer || !this.axisBuffer) {
			throw new Error('Scalar-field WebGL2 resources are unavailable.')
		}

		const uploadStarted = performance.now()
		this.uploadRaster(view)
		this.uploadContours(view)
		this.uploadAxes(view)
		const uploadMs = performance.now() - uploadStarted

		const renderStarted = performance.now()
		const background = parseCssColorRgba(view.background)
		this.gl.clearColor(background[0], background[1], background[2], background[3])
		this.gl.clear(this.gl.COLOR_BUFFER_BIT)
		this.gl.useProgram(this.textureProgram)
		this.gl.activeTexture(this.gl.TEXTURE0)
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture)
		const sampler = this.gl.getUniformLocation(this.textureProgram, 'uTexture')
		if (sampler) this.gl.uniform1i(sampler, 0)
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
		this.primitives.draw(this.contourBuffer, this.gl.LINES, this.contourVertexCount, this.viewport)
		this.primitives.draw(this.axisBuffer, this.gl.LINES, 4, this.viewport)
		return { uploadMs, renderMs: performance.now() - renderStarted }
	}

	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		this.removeLifecycle()
		this.primitives?.disposeBuffer(this.contourBuffer)
		this.primitives?.disposeBuffer(this.axisBuffer)
		this.primitives?.dispose()
		if (this.texture) this.gl.deleteTexture(this.texture)
		if (this.textureProgram) this.gl.deleteProgram(this.textureProgram)
		this.primitives = undefined
		this.contourBuffer = undefined
		this.axisBuffer = undefined
		this.texture = undefined
		this.textureProgram = undefined
		this.viewport = undefined
		this.canvas.width = 0
		this.canvas.height = 0
	}
}

export const createScalarFieldWebGL2Renderer = (canvas: HTMLCanvasElement): Renderer<ScalarFieldRenderView> =>
	new ScalarFieldWebGL2Renderer(canvas)
