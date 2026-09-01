import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom, createViewport, normalizeParameters } from '../core/index.ts'
import { flyingLinesDefinition, flyingLinesParameters } from '../effects/index.ts'

test('main and worker CPU compositions replay within the declared tolerance', () => {
	const parameters = normalizeParameters(flyingLinesParameters, {})
	if (!parameters.ok) throw new Error('Flying Lines defaults are invalid.')
	const create = () => flyingLinesDefinition.createSimulation({
		random: createSeededRandom('phase-7-parity'),
		viewport: createViewport({ cssWidth: 1280, cssHeight: 720, devicePixelRatio: 1 }),
	}, parameters.value)
	const main = create()
	const worker = create()
	let maximumDifference = 0

	for (let index = 0; index < 240; index++) {
		if (index === 24) {
			main.applyInput({ type: 'add-point', x: 200, y: 300 })
			worker.applyInput({ type: 'add-point', x: 200, y: 300 })
		}
		const step = { index, dtSeconds: 1 / 120, elapsedSeconds: (index + 1) / 120 }
		main.step(step)
		worker.step(step)
	}

	for (let index = 0; index < main.state.particles.count; index++) {
		maximumDifference = Math.max(
			maximumDifference,
			Math.abs((main.state.particles.x[index] ?? 0) - (worker.state.particles.x[index] ?? 0)),
			Math.abs((main.state.particles.y[index] ?? 0) - (worker.state.particles.y[index] ?? 0)),
		)
	}
	assert.ok(maximumDifference <= flyingLinesDefinition.timing.stateTolerance)
	assert.equal(maximumDifference, 0)
})
