import { createPhaseSpaceTransform } from '../../core/index.ts'
import type { RenderFrame, Renderer, Viewport } from '../../core/index.ts'

export interface ScalarFieldRenderGrid {
	readonly columns: number
	readonly rows: number
	readonly minX: number
	readonly maxX: number
	readonly minY: number
	readonly maxY: number
	readonly values: Float64Array
	readonly validCount: number
	readonly invalidCount: number
}

export interface ScalarFieldRenderView {
	readonly background: string
	readonly domainRadius: number
	readonly title: string
	readonly grid: ScalarFieldRenderGrid
	readonly contourLevel: number
	readonly valueScale: number
}

interface Point {
	readonly x: number
	readonly y: number
}

type Edge = 'top' | 'right' | 'bottom' | 'left'

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

const fieldColor = (value: number, scale: number): string => {
	const normalized = clamp(value / scale, -1, 1)
	const magnitude = Math.abs(normalized)
	const hue = normalized < 0 ? 218 : 18
	const lightness = 13 + magnitude * 42
	return `hsl(${hue}, 72%, ${lightness}%)`
}

const interpolate = (a: Point, b: Point, valueA: number, valueB: number, level: number): Point => {
	const denominator = valueB - valueA
	const t = denominator === 0 ? 0.5 : clamp((level - valueA) / denominator, 0, 1)
	return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

const drawSegment = (
	context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
	start: Point,
	end: Point,
) => {
	context.moveTo(start.x, start.y)
	context.lineTo(end.x, end.y)
}

class ScalarFieldCanvasRenderer implements Renderer<ScalarFieldRenderView> {
	private readonly canvas: HTMLCanvasElement | OffscreenCanvas
	private readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
	private viewport: Viewport | undefined
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
				const topLeft = transform.toCanvas({ x: xAt(column), y: yAt(row) })
				const bottomRight = transform.toCanvas({ x: xAt(column + 1), y: yAt(row + 1) })
				this.context.fillStyle = fieldColor(average, view.valueScale)
				this.context.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x + 0.5, bottomRight.y - topLeft.y + 0.5)
			}
		}

		this.context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
		this.context.lineWidth = 1.25
		this.context.beginPath()
		for (let row = 0; row < grid.rows - 1; row++) {
			for (let column = 0; column < grid.columns - 1; column++) {
				const topLeftValue = valueAt(row, column)
				const topRightValue = valueAt(row, column + 1)
				const bottomRightValue = valueAt(row + 1, column + 1)
				const bottomLeftValue = valueAt(row + 1, column)
				const values = [topLeftValue, topRightValue, bottomRightValue, bottomLeftValue]
				if (!values.every(Number.isFinite)) continue

				const topLeft = transform.toCanvas({ x: xAt(column), y: yAt(row) })
				const topRight = transform.toCanvas({ x: xAt(column + 1), y: yAt(row) })
				const bottomRight = transform.toCanvas({ x: xAt(column + 1), y: yAt(row + 1) })
				const bottomLeft = transform.toCanvas({ x: xAt(column), y: yAt(row + 1) })
				const above = values.map((value) => value >= view.contourLevel)
				const caseIndex = (above[0] ? 1 : 0) | (above[1] ? 2 : 0) | (above[2] ? 4 : 0) | (above[3] ? 8 : 0)
				if (caseIndex === 0 || caseIndex === 15) continue

				const crossings = new Map<Edge, Point>()
				if (above[0] !== above[1]) crossings.set('top', interpolate(topLeft, topRight, topLeftValue, topRightValue, view.contourLevel))
				if (above[1] !== above[2]) crossings.set('right', interpolate(topRight, bottomRight, topRightValue, bottomRightValue, view.contourLevel))
				if (above[2] !== above[3]) crossings.set('bottom', interpolate(bottomRight, bottomLeft, bottomRightValue, bottomLeftValue, view.contourLevel))
				if (above[3] !== above[0]) crossings.set('left', interpolate(bottomLeft, topLeft, bottomLeftValue, topLeftValue, view.contourLevel))

				if (crossings.size === 2) {
					const points = [...crossings.values()]
					if (points[0] && points[1]) drawSegment(this.context, points[0], points[1])
				} else if (crossings.size === 4) {
					const centerAbove = values.reduce((sum, value) => sum + value, 0) / 4 >= view.contourLevel
					const pairs: readonly (readonly [Edge, Edge])[] = caseIndex === 5
						? centerAbove ? [['top', 'right'], ['bottom', 'left']] : [['top', 'left'], ['right', 'bottom']]
						: centerAbove ? [['top', 'left'], ['right', 'bottom']] : [['top', 'right'], ['bottom', 'left']]
					for (const [first, second] of pairs) {
						const start = crossings.get(first)
						const end = crossings.get(second)
						if (start && end) drawSegment(this.context, start, end)
					}
				}
			}
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
		this.canvas.width = 0
		this.canvas.height = 0
	}
}

export const createScalarFieldCanvasRenderer = (
	canvas: HTMLCanvasElement | OffscreenCanvas,
): Renderer<ScalarFieldRenderView> => new ScalarFieldCanvasRenderer(canvas)
