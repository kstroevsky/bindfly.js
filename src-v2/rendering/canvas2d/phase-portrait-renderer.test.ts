import assert from 'node:assert/strict'
import test from 'node:test'

import { createViewport } from '../../core/index.ts'
import { createPhasePortraitCanvasRenderer } from './phase-portrait-renderer.ts'

test('breaks continuous trajectories at configuration epoch boundaries', () => {
	const calls: string[] = []
	const context = {
		setTransform: () => {},
		fillRect: () => {},
		beginPath: () => {},
		moveTo: () => calls.push('moveTo'),
		lineTo: () => calls.push('lineTo'),
		stroke: () => {},
		arc: () => {},
		fill: () => {},
		fillText: () => {},
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
	const renderer = createPhasePortraitCanvasRenderer(canvas)
	renderer.resize(createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 }))
	renderer.render({
		background: '#000',
		domainRadius: 3,
		title: 'epoch test',
		trajectories: [{
			id: 0,
			x: 1,
			y: 1,
			status: 'active',
			trailX: [0, 0.5, 0.5, 1],
			trailY: [0, 0.5, 0.5, 1],
			trailEpochs: [0, 0, 1, 1],
		}],
	}, { frameIndex: 0, simulationStepIndex: 0, interpolationAlpha: 0 })

	assert.equal(calls.filter((call) => call === 'moveTo').length, 4)
	assert.equal(calls.filter((call) => call === 'lineTo').length, 4)
})
