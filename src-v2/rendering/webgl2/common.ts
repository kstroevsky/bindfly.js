import type { Viewport } from '../../core/index.ts'

export type NormalizedRgba = readonly [number, number, number, number]

interface DisjointTimerQueryWebGL2Extension {
	readonly TIME_ELAPSED_EXT: number
	readonly GPU_DISJOINT_EXT: number
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export const hslToNormalizedRgba = (
	hueDegrees: number,
	saturation: number,
	lightness: number,
	alpha = 1,
): NormalizedRgba => {
	const hue = ((hueDegrees % 360) + 360) % 360
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
	const hueSector = hue / 60
	const secondary = chroma * (1 - Math.abs(hueSector % 2 - 1))
	let red = 0
	let green = 0
	let blue = 0
	if (hueSector < 1) [red, green] = [chroma, secondary]
	else if (hueSector < 2) [red, green] = [secondary, chroma]
	else if (hueSector < 3) [green, blue] = [chroma, secondary]
	else if (hueSector < 4) [green, blue] = [secondary, chroma]
	else if (hueSector < 5) [red, blue] = [secondary, chroma]
	else [red, blue] = [chroma, secondary]
	const match = lightness - chroma / 2
	return [red + match, green + match, blue + match, clamp01(alpha)]
}

const component = (value: string) => clamp01(Number(value) / 255)

export const parseCssColorRgba = (value: string): NormalizedRgba => {
	const color = value.trim().toLowerCase()
	const shortHex = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])?$/.exec(color)
	if (shortHex) {
		return [
			Number.parseInt(`${shortHex[1]}${shortHex[1]}`, 16) / 255,
			Number.parseInt(`${shortHex[2]}${shortHex[2]}`, 16) / 255,
			Number.parseInt(`${shortHex[3]}${shortHex[3]}`, 16) / 255,
			shortHex[4] ? Number.parseInt(`${shortHex[4]}${shortHex[4]}`, 16) / 255 : 1,
		]
	}
	const longHex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/.exec(color)
	if (longHex) {
		return [
			Number.parseInt(longHex[1] ?? '00', 16) / 255,
			Number.parseInt(longHex[2] ?? '00', 16) / 255,
			Number.parseInt(longHex[3] ?? '00', 16) / 255,
			longHex[4] ? Number.parseInt(longHex[4], 16) / 255 : 1,
		]
	}
	const functional = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(color)
	if (functional) {
		return [
			component(functional[1] ?? '0'),
			component(functional[2] ?? '0'),
			component(functional[3] ?? '0'),
			functional[4] === undefined ? 1 : clamp01(Number(functional[4])),
		]
	}
	return [0, 0, 0, 1]
}

export const createWebGL2Context = (canvas: HTMLCanvasElement): WebGL2RenderingContext => {
	const context = canvas.getContext('webgl2', {
		alpha: false,
		antialias: true,
		depth: false,
		preserveDrawingBuffer: false,
		stencil: false,
	})
	if (!context) throw new Error('WebGL2 is unavailable for this renderer.')
	context.enable(context.BLEND)
	context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA)
	return context
}

export class WebGL2GpuTimer {
	private readonly gl: WebGL2RenderingContext
	private readonly extension: DisjointTimerQueryWebGL2Extension | null
	private readonly pending: WebGLQuery[] = []
	private active: WebGLQuery | undefined

	constructor(gl: WebGL2RenderingContext) {
		this.gl = gl
		this.extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as DisjointTimerQueryWebGL2Extension | null
	}

	get supported(): boolean {
		return this.extension !== null
	}

	poll(): number | undefined {
		const extension = this.extension
		const query = this.pending[0]
		if (!extension || !query) return undefined
		if (!this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE)) return undefined
		this.pending.shift()
		const disjoint = Boolean(this.gl.getParameter(extension.GPU_DISJOINT_EXT))
		const elapsedNanoseconds = Number(this.gl.getQueryParameter(query, this.gl.QUERY_RESULT))
		this.gl.deleteQuery(query)
		return disjoint || !Number.isFinite(elapsedNanoseconds) ? undefined : elapsedNanoseconds / 1_000_000
	}

	begin(): void {
		const extension = this.extension
		if (!extension || this.active) return
		const query = this.gl.createQuery()
		if (!query) return
		this.gl.beginQuery(extension.TIME_ELAPSED_EXT, query)
		this.active = query
	}

	end(): void {
		const extension = this.extension
		const query = this.active
		if (!extension || !query) return
		this.gl.endQuery(extension.TIME_ELAPSED_EXT)
		this.pending.push(query)
		this.active = undefined
	}

	dispose(): void {
		if (this.active) {
			this.gl.deleteQuery(this.active)
			this.active = undefined
		}
		for (const query of this.pending) this.gl.deleteQuery(query)
		this.pending.length = 0
	}
}

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
	const shader = gl.createShader(type)
	if (!shader) throw new Error('Unable to allocate a WebGL2 shader.')
	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile failure.'
		gl.deleteShader(shader)
		throw new Error(`WebGL2 shader compile failed: ${message}`)
	}
	return shader
}

export const createWebGL2Program = (
	gl: WebGL2RenderingContext,
	vertexSource: string,
	fragmentSource: string,
): WebGLProgram => {
	const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource)
	const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
	const program = gl.createProgram()
	if (!program) {
		gl.deleteShader(vertex)
		gl.deleteShader(fragment)
		throw new Error('Unable to allocate a WebGL2 program.')
	}
	gl.attachShader(program, vertex)
	gl.attachShader(program, fragment)
	gl.linkProgram(program)
	gl.deleteShader(vertex)
	gl.deleteShader(fragment)
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const message = gl.getProgramInfoLog(program) ?? 'Unknown program link failure.'
		gl.deleteProgram(program)
		throw new Error(`WebGL2 program link failed: ${message}`)
	}
	return program
}

const requiredUniform = (gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation => {
	const location = gl.getUniformLocation(program, name)
	if (!location) throw new Error(`WebGL2 uniform '${name}' is unavailable.`)
	return location
}

const COLORED_VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
in vec4 aColor;
uniform vec2 uViewportCss;
uniform float uPointSize;
out vec4 vColor;
void main() {
  vec2 clip = vec2(
    aPosition.x / uViewportCss.x * 2.0 - 1.0,
    1.0 - aPosition.y / uViewportCss.y * 2.0
  );
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uPointSize;
  vColor = aColor;
}`

const COLORED_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec4 vColor;
uniform bool uRoundPoints;
out vec4 outColor;
void main() {
  if (uRoundPoints && distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
  outColor = vColor;
}`

export class ColoredPrimitiveProgram {
	private readonly gl: WebGL2RenderingContext
	private readonly program: WebGLProgram
	private readonly positionLocation: number
	private readonly colorLocation: number
	private readonly viewportLocation: WebGLUniformLocation
	private readonly pointSizeLocation: WebGLUniformLocation
	private readonly roundPointsLocation: WebGLUniformLocation

	constructor(gl: WebGL2RenderingContext) {
		this.gl = gl
		this.program = createWebGL2Program(gl, COLORED_VERTEX_SHADER, COLORED_FRAGMENT_SHADER)
		this.positionLocation = gl.getAttribLocation(this.program, 'aPosition')
		this.colorLocation = gl.getAttribLocation(this.program, 'aColor')
		if (this.positionLocation < 0 || this.colorLocation < 0) throw new Error('WebGL2 colored primitive attributes are unavailable.')
		this.viewportLocation = requiredUniform(gl, this.program, 'uViewportCss')
		this.pointSizeLocation = requiredUniform(gl, this.program, 'uPointSize')
		this.roundPointsLocation = requiredUniform(gl, this.program, 'uRoundPoints')
	}

	createBuffer(): WebGLBuffer {
		const buffer = this.gl.createBuffer()
		if (!buffer) throw new Error('Unable to allocate a WebGL2 primitive buffer.')
		return buffer
	}

	upload(buffer: WebGLBuffer, vertices: Float32Array): void {
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
		this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW)
	}

	draw(
		buffer: WebGLBuffer,
		mode: number,
		vertexCount: number,
		viewport: Viewport,
		pointSize = 1,
		roundPoints = false,
	): void {
		if (vertexCount <= 0) return
		const gl = this.gl
		gl.useProgram(this.program)
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.enableVertexAttribArray(this.positionLocation)
		gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 24, 0)
		gl.enableVertexAttribArray(this.colorLocation)
		gl.vertexAttribPointer(this.colorLocation, 4, gl.FLOAT, false, 24, 8)
		gl.uniform2f(this.viewportLocation, viewport.cssWidth, viewport.cssHeight)
		gl.uniform1f(this.pointSizeLocation, pointSize * viewport.devicePixelRatio)
		gl.uniform1i(this.roundPointsLocation, roundPoints ? 1 : 0)
		gl.drawArrays(mode, 0, vertexCount)
	}

	disposeBuffer(buffer: WebGLBuffer | undefined): void {
		if (buffer) this.gl.deleteBuffer(buffer)
	}

	dispose(): void {
		this.gl.deleteProgram(this.program)
	}
}

export const appendColoredVertex = (
	vertices: number[],
	x: number,
	y: number,
	color: NormalizedRgba,
): void => {
	vertices.push(x, y, color[0], color[1], color[2], color[3])
}

export const resizeWebGLCanvas = (
	canvas: HTMLCanvasElement,
	gl: WebGL2RenderingContext,
	viewport: Viewport,
): void => {
	canvas.width = viewport.backingWidth
	canvas.height = viewport.backingHeight
	canvas.style.width = `${viewport.cssWidth}px`
	canvas.style.height = `${viewport.cssHeight}px`
	gl.viewport(0, 0, viewport.backingWidth, viewport.backingHeight)
}

export const installWebGL2ContextLifecycle = (
	canvas: HTMLCanvasElement,
	handlers: { readonly lost: () => void; readonly restored: () => void },
): (() => void) => {
	const lost = (event: Event) => {
		event.preventDefault()
		handlers.lost()
	}
	const restored = () => handlers.restored()
	canvas.addEventListener('webglcontextlost', lost)
	canvas.addEventListener('webglcontextrestored', restored)
	return () => {
		canvas.removeEventListener('webglcontextlost', lost)
		canvas.removeEventListener('webglcontextrestored', restored)
	}
}
