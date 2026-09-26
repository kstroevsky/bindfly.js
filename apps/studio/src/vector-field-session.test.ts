import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeParameters } from '../../../src-v2/core/index.ts'
import { createViewport } from '../../../src-v2/core/viewport.ts'
import { vectorFieldParameters } from '../../../src-v2/effects/vector-field/parameters.ts'
import { createVectorFieldSession } from './vector-field-session.ts'
import type { VectorFieldProbe } from './vector-field-session.ts'

const createCanvas = () => ({
	width: 0,
	height: 0,
	style: { width: '', height: '' },
	getContext: () => ({
		setTransform: () => {},
		fillRect: () => {},
		beginPath: () => {},
		moveTo: () => {},
		lineTo: () => {},
		stroke: () => {},
		arc: () => {},
		fill: () => {},
		fillText: () => {},
		fillStyle: '',
		strokeStyle: '',
		font: '',
		lineWidth: 0,
	}),
}) as unknown as HTMLCanvasElement

test('hot coefficient updates preserve trajectory state and affect the next RK4 step', () => {
	const normalized = normalizeParameters(vectorFieldParameters, {
		dxFormula: 'mu*x',
		dyFormula: '0',
		mu: 1,
	})
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return
	const session = createVectorFieldSession({
		canvas: createCanvas(),
		parameters: normalized.value,
		seed: 'hot-field',
		viewport: createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 }),
	})

	session.step({ index: 1, dtSeconds: 0.1, elapsedSeconds: 0.1 })
	const beforeSnapshot = session.snapshot()
	const before = beforeSnapshot.trajectories[0]?.x
	assert.ok(before !== undefined)
	assert.equal(beforeSnapshot.configurationEpoch, 0)
	session.updateParameters({ mu: 2 })
	const changed = session.snapshot()
	assert.equal(changed.trajectories[0]?.x, before)
	assert.equal(changed.configurationEpoch, 1)
	assert.deepEqual(changed.trajectories[0]?.trailEpochs.slice(-2), [0, 1])
	session.step({ index: 2, dtSeconds: 0.1, elapsedSeconds: 0.2 })
	const afterSnapshot = session.snapshot()
	const after = afterSnapshot.trajectories[0]?.x
	assert.ok(after !== undefined)
	assert.equal(afterSnapshot.trajectories[0]?.trailEpochs.at(-1), 1)
	const rk4Factor = 1 + 0.2 + 0.2 ** 2 / 2 + 0.2 ** 3 / 6 + 0.2 ** 4 / 24
	assert.ok(Math.abs(after - before * rk4Factor) < 1e-12)
	session.updateParameters({ background: '#111' })
	assert.equal(session.snapshot().configurationEpoch, 1)
	session.dispose()
})

test('formula Probe evaluates the vector field and returns canonical VM traces', () => {
	const normalized = normalizeParameters(vectorFieldParameters, {
		dxFormula: 'mu*x - y',
		dyFormula: 'x + y',
		mu: 1.5,
	})
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return
	const session = createVectorFieldSession({
		canvas: createCanvas(),
		parameters: normalized.value,
		seed: 'probe-field',
		viewport: createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 }),
	})
	const probe = session.inspectPoint?.({ x: 300, y: 75, maxDistance: 18 }) as VectorFieldProbe
	assert.equal(probe.kind, 'vector-field-probe')
	assert.equal(probe.x, 2)
	assert.equal(probe.y, 1.5)
	assert.equal(probe.dx.value, 1.5)
	assert.equal(probe.dy.value, 3.5)
	assert.ok(probe.dx.trace.some(({ expression }) => expression === 'mu*x'))
	assert.ok(probe.dy.trace.some(({ expression }) => expression === 'x + y'))
	session.dispose()
})
