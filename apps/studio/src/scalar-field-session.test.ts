import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeParameters } from '../../../src-v2/core/index.ts'
import { createViewport } from '../../../src-v2/core/viewport.ts'
import { scalarFieldParameters } from '../../../src-v2/effects/scalar-field/parameters.ts'
import { createScalarFieldSession } from './scalar-field-session.ts'
import type { ScalarFieldProbe } from './scalar-field-session.ts'

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
		fillText: () => {},
		fillStyle: '',
		strokeStyle: '',
		font: '',
		lineWidth: 0,
	}),
}) as unknown as HTMLCanvasElement

test('scalar field Probe uses isotropic coordinates and declared coefficients', () => {
	const normalized = normalizeParameters(scalarFieldParameters, { k: 1, sampleDensity: 16 })
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return
	const session = createScalarFieldSession({
		canvas: createCanvas(),
		parameters: normalized.value,
		seed: 'scalar-probe',
		viewport: createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 }),
	})
	const probe = session.inspectPoint?.({ x: 250, y: 150, maxDistance: 18 }) as ScalarFieldProbe
	assert.equal(probe.kind, 'scalar-field-probe')
	assert.equal(probe.x, 1)
	assert.equal(probe.y, 0)
	assert.equal(probe.value, 0)
	assert.ok(probe.trace.some(({ expression }) => expression === 'x^2'))

	session.updateParameters({ k: 2 })
	const changed = session.inspectPoint?.({ x: 250, y: 150, maxDistance: 18 }) as ScalarFieldProbe
	assert.equal(changed.value, -1)
	session.dispose()
})

test('scalar-field render sampling reports finite and invalid samples without advancing field state', () => {
	const normalized = normalizeParameters(scalarFieldParameters, { formula: 'sqrt(x)', sampleDensity: 16 })
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return
	const session = createScalarFieldSession({
		canvas: createCanvas(),
		parameters: normalized.value,
		seed: 'scalar-domain',
		viewport: createViewport({ cssWidth: 400, cssHeight: 300, devicePixelRatio: 1 }),
	})
	const telemetry = session.render({ frameIndex: 0, simulationStepIndex: 4, interpolationAlpha: 0 })
	assert.ok(telemetry.points > 0)
	assert.ok(telemetry.edges > 0)
	assert.equal(telemetry.step, 4)
	assert.deepEqual(session.snapshot(), { staticField: true })
	session.dispose()
})
