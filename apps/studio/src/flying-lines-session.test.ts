import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeParameters } from '../../../src-v2/core/parameters.ts'
import { createViewport } from '../../../src-v2/core/viewport.ts'
import { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import { createFlyingLinesSession } from './flying-lines-session.ts'

class FakeCanvasContext {
	fillStyle = ''
	strokeStyle = ''
	lineWidth = 0
	globalAlpha = 1
	setTransform(): void {}
	fillRect(): void {}
	beginPath(): void {}
	moveTo(): void {}
	lineTo(): void {}
	stroke(): void {}
	arc(): void {}
	fill(): void {}
}

class FakeOffscreenCanvas {
	width = 0
	height = 0
	readonly context = new FakeCanvasContext()
	getContext(): OffscreenCanvasRenderingContext2D {
		return this.context as unknown as OffscreenCanvasRenderingContext2D
	}
}

const defaults = normalizeParameters(flyingLinesParameters, {})
if (!defaults.ok) throw new Error('Flying Lines defaults are invalid.')

test('one session owns composition and applies the minimum parameter invalidation', () => {
	const canvas = new FakeOffscreenCanvas()
	const viewport = createViewport({ cssWidth: 640, cssHeight: 360, devicePixelRatio: 2 })
	const session = createFlyingLinesSession({
		canvas: canvas as unknown as OffscreenCanvas,
		parameters: defaults.value,
		seed: 'session-fixture',
		viewport,
	})

	session.resize(viewport)
	session.applyInput({ type: 'add-point', x: 100, y: 120 })
	const beforeHotUpdate = session.render({ frameIndex: 0, simulationStepIndex: 0, interpolationAlpha: 0 })
	assert.equal(beforeHotUpdate.points, 101)

	session.updateParameters({ background: '#111827', connectionRadius: 80 })
	const afterHotUpdate = session.render({ frameIndex: 1, simulationStepIndex: 0, interpolationAlpha: 0 })
	assert.equal(afterHotUpdate.points, 101)
	assert.equal(session.parameters.background, '#111827')

	session.updateParameters({ particleCount: 24 })
	const afterReset = session.render({ frameIndex: 2, simulationStepIndex: 0, interpolationAlpha: 0 })
	assert.equal(afterReset.points, 24)

	session.recordDroppedSteps(3)
	assert.equal(session.telemetry.droppedSteps, 3)
	assert.equal(session.snapshot().particles.count, 24)
	const collaborationCheckpoint = session.collaboration?.captureStateBytes()
	assert.ok(collaborationCheckpoint)
	session.applyInput({ type: 'add-point', x: 200, y: 180 })
	assert.equal(session.snapshot().particles.count, 25)
	session.collaboration?.restoreStateBytes(collaborationCheckpoint)
	assert.equal(session.snapshot().particles.count, 24)
	session.dispose()
})
