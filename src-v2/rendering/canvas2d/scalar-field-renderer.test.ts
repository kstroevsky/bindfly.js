import assert from 'node:assert/strict'
import test from 'node:test'

import { createViewport } from '../../core/index.ts'
import { extractScalarFieldContourSegments, scalarFieldColorRgba } from '../scalar-field.ts'
import { createScalarFieldCanvasRenderer } from './scalar-field-renderer.ts'

const grid = ([topLeft, topRight, bottomRight, bottomLeft]: readonly [number, number, number, number]) => ({
	columns: 2,
	rows: 2,
	minX: 0,
	maxX: 1,
	minY: 0,
	maxY: 1,
	values: new Float64Array([topLeft, topRight, bottomLeft, bottomRight]),
	validCount: 4,
	invalidCount: 0,
})

const edgeFor = ({ x, y }: { readonly x: number; readonly y: number }) => {
	if (Math.abs(y - 1) < 1e-12) return 'top'
	if (Math.abs(x - 1) < 1e-12) return 'right'
	if (Math.abs(y) < 1e-12) return 'bottom'
	if (Math.abs(x) < 1e-12) return 'left'
	return 'interior'
}

const edgePairs = (values: readonly [number, number, number, number]) => extractScalarFieldContourSegments(grid(values), 0)
	.map(({ start, end }) => [edgeFor(start), edgeFor(end)].sort().join('-'))
	.sort()

test('uses the bilinear saddle rather than the arithmetic center for ambiguous contour cells', () => {
	assert.deepEqual(edgePairs([100, -50, 1, -50]), ['bottom-right', 'left-top'])
	assert.deepEqual(edgePairs([50, -100, 50, -1]), ['bottom-left', 'right-top'])
})

test('keeps asymptotic-decider topology invariant under very small scalar rescaling', () => {
	const scale = 1e-18
	assert.deepEqual(edgePairs([100 * scale, -50 * scale, 1 * scale, -50 * scale]), ['bottom-right', 'left-top'])
})

test('represents a contour through the bilinear saddle as four branches meeting at the critical point', () => {
	const segments = extractScalarFieldContourSegments(grid([4, -2, 1, -2]), 0)
	assert.equal(segments.length, 4)
	for (const segment of segments) {
		assert.ok(Math.abs(segment.end.x - 2 / 3) < 1e-12)
		assert.ok(Math.abs(segment.end.y - 1 / 3) < 1e-12)
	}
})

test('caches the scalar raster independently from background and contour changes', () => {
	const calls: string[] = []
	const rasterContext = {
		createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
		putImageData: () => calls.push('putImageData'),
	}
	const rasterCanvas = {
		width: 0,
		height: 0,
		getContext: () => rasterContext,
	}
	const context = {
		setTransform: () => {},
		fillRect: () => calls.push('fillRect'),
		drawImage: () => calls.push('drawImage'),
		beginPath: () => {},
		moveTo: () => {},
		lineTo: () => {},
		stroke: () => {},
		fillText: () => {},
		fillStyle: '',
		strokeStyle: '',
		font: '',
		lineWidth: 0,
		imageSmoothingEnabled: true,
	}
	const canvas = {
		width: 0,
		height: 0,
		style: { width: '', height: '' },
		ownerDocument: { createElement: () => rasterCanvas },
		getContext: () => context,
	} as unknown as HTMLCanvasElement
	const renderer = createScalarFieldCanvasRenderer(canvas)
	renderer.resize(createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 }))
	const sampledGrid = grid([-1, 1, -1, 1])
	const baseView = {
		background: '#000',
		domainRadius: 3,
		title: 'cached scalar field',
		contourLevel: 0,
		valueScale: 2,
		grid: sampledGrid,
	}

	renderer.render(baseView, { frameIndex: 0, simulationStepIndex: 0, interpolationAlpha: 0 })
	renderer.render({ ...baseView, background: '#111', contourLevel: 0.25 }, { frameIndex: 1, simulationStepIndex: 0, interpolationAlpha: 0 })
	assert.equal(calls.filter((call) => call === 'putImageData').length, 1)
	assert.equal(calls.filter((call) => call === 'drawImage').length, 2)

	renderer.render({ ...baseView, valueScale: 4 }, { frameIndex: 2, simulationStepIndex: 0, interpolationAlpha: 0 })
	assert.equal(calls.filter((call) => call === 'putImageData').length, 2)
	assert.equal(calls.filter((call) => call === 'drawImage').length, 3)
	renderer.dispose()
})

test('renders sampled scalar cells and an interpolated contour', () => {
	const calls: string[] = []
	const fieldFillStyles: string[] = []
	const context = {
		setTransform: () => {},
		fillRect: () => {
			calls.push('fillRect')
			fieldFillStyles.push(context.fillStyle)
		},
		beginPath: () => {},
		moveTo: () => calls.push('moveTo'),
		lineTo: () => calls.push('lineTo'),
		stroke: () => calls.push('stroke'),
		fillText: (text: string) => calls.push(`text:${text}`),
		fillStyle: '',
		strokeStyle: '',
		font: '',
		lineWidth: 0,
	}
	const canvas = {
		width: 0,
		height: 0,
		style: { width: '', height: '' },
		getContext: () => context,
	} as unknown as HTMLCanvasElement
	const renderer = createScalarFieldCanvasRenderer(canvas)
	renderer.resize(createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 }))
	renderer.render({
		background: '#000',
		domainRadius: 3,
		title: 'scalar field test',
		contourLevel: 0,
		valueScale: 2,
		grid: {
			columns: 2,
			rows: 2,
			minX: -1,
			maxX: 1,
			minY: -1,
			maxY: 1,
			values: new Float64Array([-1, 1, -1, 1]),
			validCount: 4,
			invalidCount: 0,
		},
	}, { frameIndex: 0, simulationStepIndex: 0, interpolationAlpha: 0 })

	assert.equal(calls.filter((call) => call === 'fillRect').length, 2)
	const [red, green, blue, alpha] = scalarFieldColorRgba(0, 2)
	assert.equal(fieldFillStyles[1], `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`)
	assert.ok(calls.filter((call) => call === 'lineTo').length >= 3)
	assert.ok(calls.includes('text:scalar field test'))
	assert.ok(calls.includes('text:contour z=0.00 · color scale ±2.0'))
})
