import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeParameters } from '../../../src-v2/core/index.ts'
import { createViewport } from '../../../src-v2/core/viewport.ts'
import { discreteMapParameters } from '../../../src-v2/effects/discrete-map/parameters.ts'
import { createDiscreteMapSession } from './discrete-map-session.ts'

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

test('hot map parameter updates preserve the orbit and change the next iteration', () => {
	const normalized = normalizeParameters(discreteMapParameters, {
		nextXFormula: 'a*x + 1',
		nextYFormula: 'y',
		a: 1,
	})
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return
	const session = createDiscreteMapSession({
		canvas: createCanvas(),
		parameters: normalized.value,
		seed: 'hot-map',
		viewport: createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 }),
	})
	session.step({ index: 1, dtSeconds: 1 / 12, elapsedSeconds: 1 / 12 })
	assert.equal(session.snapshot().orbits[0]?.x, 1)
	session.updateParameters({ a: 2 })
	assert.equal(session.snapshot().orbits[0]?.x, 1)
	session.step({ index: 2, dtSeconds: 1 / 12, elapsedSeconds: 2 / 12 })
	assert.equal(session.snapshot().orbits[0]?.x, 3)
	assert.equal(session.snapshot().iteration, 2)
	session.dispose()
})
