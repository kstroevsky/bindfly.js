import assert from 'node:assert/strict'
import test from 'node:test'

import { createViewport } from '../../core/index.ts'
import { createFlyingLinesCanvasRenderer } from './flying-lines-renderer.ts'

test('resizes backing store and renders each unique edge once', () => {
	const calls: string[] = []
	const context = {
		setTransform: (...values: number[]) => calls.push(`transform:${values.join(',')}`),
		fillRect: () => calls.push('fillRect'),
		beginPath: () => calls.push('beginPath'),
		moveTo: () => calls.push('moveTo'),
		lineTo: () => calls.push('lineTo'),
		stroke: () => calls.push('stroke'),
		arc: () => calls.push('arc'),
		fill: () => calls.push('fill'),
		save: () => calls.push('save'),
		restore: () => calls.push('restore'),
		rect: () => calls.push('rect'),
		clip: () => calls.push('clip'),
		translate: () => calls.push('translate'),
		scale: () => calls.push('scale'),
		fillText: (label: string) => calls.push(`fillText:${label}`),
		fillStyle: '',
		strokeStyle: '',
		font: '',
		globalAlpha: 1,
		lineWidth: 0,
	}
	const canvas = {
		width: 0,
		height: 0,
		style: { width: '', height: '' },
		getContext: () => context,
	} as unknown as HTMLCanvasElement
	const renderer = createFlyingLinesCanvasRenderer(canvas)
	const viewport = createViewport({ cssWidth: 320, cssHeight: 200, devicePixelRatio: 2 })

	renderer.resize(viewport)
	renderer.render({
		background: '#000000',
		particles: {
			count: 2,
			capacity: 2,
			ids: new Uint32Array([1, 2]),
			x: new Float64Array([10, 20]),
			y: new Float64Array([10, 20]),
		},
		edges: {
			edgeCount: 1,
			sourceIndices: new Uint32Array([0]),
			targetIndices: new Uint32Array([1]),
			distances: new Float64Array([14.14]),
			opacities: new Float64Array([0.5]),
		},
	}, { frameIndex: 0, simulationStepIndex: 0, interpolationAlpha: 0 })

	assert.equal(canvas.width, 640)
	assert.equal(canvas.height, 400)
	assert.equal(canvas.style.width, '320px')
	assert.equal(calls.filter((call) => call === 'stroke').length, 1)
	assert.equal(calls.filter((call) => call === 'arc').length, 2)
})

test('renders synchronized A/B layers in two labeled panes', () => {
	const calls: string[] = []
	const context = {
		setTransform: () => {}, fillRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
		stroke: () => calls.push('stroke'), arc: () => calls.push('arc'), fill: () => {}, save: () => {}, restore: () => {},
		rect: () => {}, clip: () => {}, translate: () => {}, scale: () => {},
		fillText: (label: string) => calls.push(`label:${label}`),
		fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 0, font: '',
	}
	const canvas = {
		width: 0, height: 0, style: { width: '', height: '' }, getContext: () => context,
	} as unknown as HTMLCanvasElement
	const renderer = createFlyingLinesCanvasRenderer(canvas)
	renderer.resize(createViewport({ cssWidth: 320, cssHeight: 200, devicePixelRatio: 1 }))
	const particles = {
		count: 1, capacity: 1, ids: new Uint32Array([1]), x: new Float64Array([10]), y: new Float64Array([20]),
	}
	const edges = {
		edgeCount: 0, sourceIndices: new Uint32Array(), targetIndices: new Uint32Array(),
		distances: new Float64Array(), opacities: new Float64Array(),
	}
	renderer.render({
		background: '#000', particles, edges,
		comparison: { a: { particles, edges }, b: { particles, edges } },
	}, { frameIndex: 0, simulationStepIndex: 4, interpolationAlpha: 0 })
	assert.deepEqual(calls.filter((call) => call.startsWith('label:')), ['label:Formula A', 'label:Formula B'])
	assert.equal(calls.filter((call) => call === 'arc').length, 2)
})
