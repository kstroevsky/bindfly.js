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

export interface ScalarFieldContourPoint {
	readonly x: number
	readonly y: number
}

export interface ScalarFieldContourSegment {
	readonly start: ScalarFieldContourPoint
	readonly end: ScalarFieldContourPoint
}

export interface ScalarFieldRaster {
	readonly width: number
	readonly height: number
	readonly rgba: Uint8ClampedArray
}

type Edge = 'top' | 'right' | 'bottom' | 'left'

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))

const hslToRgb = (hueDegrees: number, saturation: number, lightness: number): readonly [number, number, number] => {
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
	return [
		Math.round((red + match) * 255),
		Math.round((green + match) * 255),
		Math.round((blue + match) * 255),
	]
}

const scalarFieldColorRgba = (value: number, scale: number): readonly [number, number, number, number] => {
	const normalized = clamp(value / scale, -1, 1)
	const magnitude = Math.abs(normalized)
	const hue = normalized < 0 ? 218 : 18
	const lightness = (13 + magnitude * 42) / 100
	const [red, green, blue] = hslToRgb(hue, 0.72, lightness)
	return [red, green, blue, 255]
}

export const createScalarFieldRaster = (
	grid: ScalarFieldRenderGrid,
	valueScale: number,
): ScalarFieldRaster => {
	const width = grid.columns - 1
	const height = grid.rows - 1
	const rgba = new Uint8ClampedArray(width * height * 4)
	const valueAt = (row: number, column: number) => grid.values[row * grid.columns + column] ?? Number.NaN

	for (let row = 0; row < height; row++) {
		for (let column = 0; column < width; column++) {
			const values = [
				valueAt(row, column),
				valueAt(row, column + 1),
				valueAt(row + 1, column + 1),
				valueAt(row + 1, column),
			]
			if (!values.every(Number.isFinite)) continue
			const average = values.reduce((sum, value) => sum + value, 0) / values.length
			const color = scalarFieldColorRgba(average, valueScale)
			const offset = (row * width + column) * 4
			rgba[offset] = color[0]
			rgba[offset + 1] = color[1]
			rgba[offset + 2] = color[2]
			rgba[offset + 3] = color[3]
		}
	}

	return { width, height, rgba }
}

const interpolate = (
	a: ScalarFieldContourPoint,
	b: ScalarFieldContourPoint,
	valueA: number,
	valueB: number,
	level: number,
): ScalarFieldContourPoint => {
	const denominator = valueB - valueA
	const t = denominator === 0 ? 0.5 : clamp((level - valueA) / denominator, 0, 1)
	return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

const ambiguousSegments = (input: {
	readonly caseIndex: number
	readonly level: number
	readonly topLeftValue: number
	readonly topRightValue: number
	readonly bottomRightValue: number
	readonly bottomLeftValue: number
	readonly topLeft: ScalarFieldContourPoint
	readonly topRight: ScalarFieldContourPoint
	readonly bottomRight: ScalarFieldContourPoint
	readonly bottomLeft: ScalarFieldContourPoint
	readonly crossings: ReadonlyMap<Edge, ScalarFieldContourPoint>
}): readonly ScalarFieldContourSegment[] => {
	const g00 = input.topLeftValue - input.level
	const g10 = input.topRightValue - input.level
	const g01 = input.bottomLeftValue - input.level
	const g11 = input.bottomRightValue - input.level
	const b = g10 - g00
	const c = g01 - g00
	const d = g00 - g10 - g01 + g11
	const scale = Math.max(Number.MIN_VALUE, Math.abs(g00), Math.abs(g10), Math.abs(g01), Math.abs(g11))
	const tolerance = 64 * Number.EPSILON * scale

	if (Math.abs(d) <= tolerance) {
		const center = {
			x: (input.topLeft.x + input.bottomRight.x) / 2,
			y: (input.topLeft.y + input.bottomRight.y) / 2,
		}
		return [...input.crossings.values()].map((start) => ({ start, end: center }))
	}

	const saddleUnitX = clamp(-c / d, 0, 1)
	const saddleUnitY = clamp(-b / d, 0, 1)
	const saddleValue = g00 - (b * c) / d
	const saddle = {
		x: input.topLeft.x + (input.topRight.x - input.topLeft.x) * saddleUnitX,
		y: input.topLeft.y + (input.bottomLeft.y - input.topLeft.y) * saddleUnitY,
	}

	if (Math.abs(saddleValue) <= tolerance) {
		return [...input.crossings.values()].map((start) => ({ start, end: saddle }))
	}

	const saddleAbove = saddleValue > 0
	const pairs: readonly (readonly [Edge, Edge])[] = input.caseIndex === 5
		? saddleAbove ? [['top', 'right'], ['bottom', 'left']] : [['top', 'left'], ['right', 'bottom']]
		: saddleAbove ? [['top', 'left'], ['right', 'bottom']] : [['top', 'right'], ['bottom', 'left']]

	return pairs.flatMap(([first, second]) => {
		const start = input.crossings.get(first)
		const end = input.crossings.get(second)
		return start && end ? [{ start, end }] : []
	})
}

export const extractScalarFieldContourSegments = (
	grid: ScalarFieldRenderGrid,
	level: number,
): readonly ScalarFieldContourSegment[] => {
	const segments: ScalarFieldContourSegment[] = []
	const xAt = (column: number) => grid.minX + column / (grid.columns - 1) * (grid.maxX - grid.minX)
	const yAt = (row: number) => grid.maxY - row / (grid.rows - 1) * (grid.maxY - grid.minY)
	const valueAt = (row: number, column: number) => grid.values[row * grid.columns + column] ?? Number.NaN

	for (let row = 0; row < grid.rows - 1; row++) {
		for (let column = 0; column < grid.columns - 1; column++) {
			const topLeftValue = valueAt(row, column)
			const topRightValue = valueAt(row, column + 1)
			const bottomRightValue = valueAt(row + 1, column + 1)
			const bottomLeftValue = valueAt(row + 1, column)
			const values = [topLeftValue, topRightValue, bottomRightValue, bottomLeftValue]
			if (!values.every(Number.isFinite)) continue

			const topLeft = { x: xAt(column), y: yAt(row) }
			const topRight = { x: xAt(column + 1), y: yAt(row) }
			const bottomRight = { x: xAt(column + 1), y: yAt(row + 1) }
			const bottomLeft = { x: xAt(column), y: yAt(row + 1) }
			const above = values.map((value) => value >= level)
			const caseIndex = (above[0] ? 1 : 0) | (above[1] ? 2 : 0) | (above[2] ? 4 : 0) | (above[3] ? 8 : 0)
			if (caseIndex === 0 || caseIndex === 15) continue

			const crossings = new Map<Edge, ScalarFieldContourPoint>()
			if (above[0] !== above[1]) crossings.set('top', interpolate(topLeft, topRight, topLeftValue, topRightValue, level))
			if (above[1] !== above[2]) crossings.set('right', interpolate(topRight, bottomRight, topRightValue, bottomRightValue, level))
			if (above[2] !== above[3]) crossings.set('bottom', interpolate(bottomRight, bottomLeft, bottomRightValue, bottomLeftValue, level))
			if (above[3] !== above[0]) crossings.set('left', interpolate(bottomLeft, topLeft, bottomLeftValue, topLeftValue, level))

			if (crossings.size === 2) {
				const points = [...crossings.values()]
				if (points[0] && points[1]) segments.push({ start: points[0], end: points[1] })
			} else if (crossings.size === 4) {
				segments.push(...ambiguousSegments({
					caseIndex,
					level,
					topLeftValue,
					topRightValue,
					bottomRightValue,
					bottomLeftValue,
					topLeft,
					topRight,
					bottomRight,
					bottomLeft,
					crossings,
				}))
			}
		}
	}

	return segments
}
