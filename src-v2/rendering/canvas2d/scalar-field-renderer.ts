import { createPhaseSpaceTransform } from '../../core/index.ts'
import type { RenderFrame, Renderer, Viewport } from '../../core/index.ts'
import { createScalarFieldRaster, extractScalarFieldContourSegments, scalarFieldColorRgba } from '../scalar-field.ts'
import type { ScalarFieldContourSegment, ScalarFieldRenderGrid, ScalarFieldRenderView } from '../scalar-field.ts'

interface Point {
	readonly x: number
	readonly y: number
}

const drawSegment = (
	context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	start: Point,
	end: Point,
) => {
	context.moveTo(start.x, start.y)
	context.lineTo(end.x, end.y)
}

type RasterCanvas = HTMLCanvasElement | OffscreenCanvas

const createRasterCanvas = (
	host: HTMLCanvasElement | OffscreenCanvas,
	width: number,
	height: number,
): RasterCanvas | undefined => {
	if ('style' in host) {
		const canvas = host.ownerDocument?.createElement('canvas')
		if (!canvas) return undefined
		canvas.width = width
		canvas.height = height
		return canvas
	}
	if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
	return undefined
}

class ScalarFieldCanvasRenderer implements Renderer<ScalarFieldRenderView> {
	private readonly canvas: HTMLCanvasElement | OffscreenCanvas
	private readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
	private viewport: Viewport | undefined
	private rasterCache: {
		readonly grid: ScalarFieldRenderGrid
		readonly valueScale: number
		readonly canvas: RasterCanvas
	} | undefined
	private contourCache: {
		readonly grid: ScalarFieldRenderGrid
		readonly contourLevel: number
		readonly segments: readonly ScalarFieldContourSegment[]
	} | undefined
	private disposed = false

	constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
		const context = 'style' in canvas
			? canvas.getContext('2d', { alpha: false })
			: canvas.getContext('2d', { alpha: false })
		if (!context) throw new Error('Scalar field requires a Canvas2D context.')
		this.canvas = canvas
		this.context = context
	}

	resize(viewport: Viewport): void {
		if (this.disposed) throw new Error('Cannot resize a disposed scalar-field renderer.')
		this.viewport = viewport
		this.canvas.width = viewport.backingWidth
		this.canvas.height = viewport.backingHeight
		if ('style' in this.canvas) {
			this.canvas.style.width = `${viewport.cssWidth}px`
			this.canvas.style.height = `${viewport.cssHeight}px`
		}
		this.context.setTransform(viewport.devicePixelRatio, 0, 0, viewport.devicePixelRatio, 0, 0)
	}

	private cachedRaster(grid: ScalarFieldRenderGrid, valueScale: number): RasterCanvas | undefined {
		if (this.rasterCache?.grid === grid && this.rasterCache.valueScale === valueScale) return this.rasterCache.canvas
		const raster = createScalarFieldRaster(grid, valueScale)
		const canvas = createRasterCanvas(this.canvas, raster.width, raster.height)
		if (!canvas) {
			this.rasterCache = undefined
			return undefined
		}
		const context = 'style' in canvas ? canvas.getContext('2d') : canvas.getContext('2d')
		if (!context) {
			this.rasterCache = undefined
			return undefined
		}
		const image = context.createImageData(raster.width, raster.height)
		image.data.set(raster.rgba)
		context.putImageData(image, 0, 0)
		this.rasterCache = { grid, valueScale, canvas }
		return canvas
	}

	private cachedContours(grid: ScalarFieldRenderGrid, contourLevel: number): readonly ScalarFieldContourSegment[] {
		if (this.contourCache?.grid === grid && this.contourCache.contourLevel === contourLevel) return this.contourCache.segments
		const segments = extractScalarFieldContourSegments(grid, contourLevel)
		this.contourCache = { grid, contourLevel, segments }
		return segments
	}

	render(view: Readonly<ScalarFieldRenderView>, _frame: RenderFrame): void {
		if (this.disposed) throw new Error('Cannot render with a disposed scalar-field renderer.')
		if (!this.viewport) throw new Error('Scalar-field renderer must be resized before rendering.')
		const transform = createPhaseSpaceTransform(this.viewport, view.domainRadius)
		const { grid } = view
		const xAt = (column: number) => grid.minX + column / (grid.columns - 1) * (grid.maxX - grid.minX)
		const yAt = (row: number) => grid.maxY - row / (grid.rows - 1) * (grid.maxY - grid.minY)
		const valueAt = (row: number, column: number) => grid.values[row * grid.columns + column] ?? Number.NaN

		this.context.fillStyle = view.background
		this.context.fillRect(0, 0, this.viewport.cssWidth, this.viewport.cssHeight)

		const raster = this.cachedRaster(grid, view.valueScale)
		if (raster) {
			this.context.imageSmoothingEnabled = false
			this.context.drawImage(raster, 0, 0, this.viewport.cssWidth, this.viewport.cssHeight)
		} else {
			for (let row = 0; row < grid.rows - 1; row++) {
				for (let column = 0; column < grid.columns - 1; column++) {
					const values = [
						valueAt(row, column),
						valueAt(row, column + 1),
						valueAt(row + 1, column + 1),
						valueAt(row + 1, column),
					]
					if (!values.every(Number.isFinite)) continue
					const average = values.reduce((sum, value) => sum + value, 0) / values.length
					const [red, green, blue, alpha] = scalarFieldColorRgba(average, view.valueScale)
					const topLeft = transform.toCanvas({ x: xAt(column), y: yAt(row) })
					const bottomRight = transform.toCanvas({ x: xAt(column + 1), y: yAt(row + 1) })
					this.context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`
					this.context.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x + 0.5, bottomRight.y - topLeft.y + 0.5)
				}
			}
		}

		this.context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
		this.context.lineWidth = 1.25
		this.context.beginPath()
		for (const segment of this.cachedContours(grid, view.contourLevel)) {
			drawSegment(this.context, transform.toCanvas(segment.start), transform.toCanvas(segment.end))
		}
		this.context.stroke()

		this.context.strokeStyle = 'rgba(255, 255, 255, 0.16)'
		this.context.lineWidth = 1
		this.context.beginPath()
		const origin = transform.toCanvas({ x: 0, y: 0 })
		this.context.moveTo(origin.x, 0)
		this.context.lineTo(origin.x, this.viewport.cssHeight)
		this.context.moveTo(0, origin.y)
		this.context.lineTo(this.viewport.cssWidth, origin.y)
		this.context.stroke()

		this.context.fillStyle = 'rgba(255, 255, 255, 0.9)'
		this.context.font = '600 12px ui-sans-serif, system-ui, sans-serif'
		this.context.fillText(view.title, 14, 24)
		this.context.font = '500 11px ui-sans-serif, system-ui, sans-serif'
		this.context.fillText(`contour z=${view.contourLevel.toFixed(2)} · color scale ±${view.valueScale.toFixed(1)}`, 14, 42)
	}

	dispose(): void {
		this.disposed = true
		this.viewport = undefined
		if (this.rasterCache) {
			this.rasterCache.canvas.width = 0
			this.rasterCache.canvas.height = 0
		}
		this.rasterCache = undefined
		this.contourCache = undefined
		this.canvas.width = 0
		this.canvas.height = 0
	}
}

export const createScalarFieldCanvasRenderer = (
	canvas: HTMLCanvasElement | OffscreenCanvas,
): Renderer<ScalarFieldRenderView> => new ScalarFieldCanvasRenderer(canvas)
