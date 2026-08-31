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
		fillStyle: '',
		strokeStyle: '',
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
		particles: [
			{ id: 1, x: 10, y: 10 },
			{ id: 2, x: 20, y: 20 },
		],
		edges: [
			{
				sourceId: 1,
				targetId: 2,
				sourceX: 10,
				sourceY: 10,
				targetX: 20,
				targetY: 20,
				distance: 14.14,
				opacity: 0.5,
			},
		],
	}, { frameIndex: 0, simulationStepIndex: 0, interpolationAlpha: 0 })

	assert.equal(canvas.width, 640)
	assert.equal(canvas.height, 400)
	assert.equal(canvas.style.width, '320px')
	assert.equal(calls.filter((call) => call === 'stroke').length, 1)
	assert.equal(calls.filter((call) => call === 'arc').length, 2)
})
