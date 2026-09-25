import assert from 'node:assert/strict'
import test from 'node:test'

import { createViewport } from '../../core/index.ts'
import { createScalarFieldCanvasRenderer } from './scalar-field-renderer.ts'

test('renders sampled scalar cells and an interpolated contour', () => {
	const calls: string[] = []
	const context = {
		setTransform: () => {},
		fillRect: () => calls.push('fillRect'),
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
	assert.ok(calls.filter((call) => call === 'lineTo').length >= 3)
	assert.ok(calls.includes('text:scalar field test'))
	assert.ok(calls.includes('text:contour z=0.00 · color scale ±2.0'))
})
