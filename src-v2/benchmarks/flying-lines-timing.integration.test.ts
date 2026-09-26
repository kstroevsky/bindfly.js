import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom, createViewport, normalizeParameters } from '../core/index.ts'
import type { SimulationStep } from '../core/index.ts'
import { flyingLinesDefinition, flyingLinesParameters } from '../effects/index.ts'
import type { FlyingLinesInput, FlyingLinesState } from '../effects/index.ts'
import { FixedStepClock } from '../runtime/index.ts'

const replayEvents = new Map<number, readonly FlyingLinesInput[]>([
	[24, [{ type: 'add-point', x: 220, y: 180 }]],
	[72, [{ type: 'move-point', id: 100, x: 300, y: 260 }]],
])

const runReplay = (displayHz: number): FlyingLinesState => {
	const normalized = normalizeParameters(flyingLinesParameters, {})
	if (!normalized.ok) throw new Error('Flying Lines defaults must be valid.')
	const simulation = flyingLinesDefinition.createSimulation({
		random: createSeededRandom('phase-4-replay'),
		viewport: createViewport({ cssWidth: 960, cssHeight: 640, devicePixelRatio: 1 }),
	}, normalized.value)
	const clock = new FixedStepClock({
		stepSeconds: flyingLinesDefinition.timing.fixedStepSeconds,
		maxCatchUpSteps: 8,
	})

	const applyStep = (step: SimulationStep) => {
		for (const input of replayEvents.get(step.index) ?? []) simulation.applyInput(input)
		simulation.step(step)
	}

	for (let frame = 0; frame < displayHz * 2; frame++) {
		for (const step of clock.advance(1 / displayHz).steps) applyStep(step)
	}
	assert.equal(clock.stepIndex, 240)
	return structuredClone(simulation.state)
}

test('Flying Lines replay is exact across common display refresh rates', () => {
	const reference = runReplay(120)
	for (const displayHz of [30, 60, 144]) assert.deepEqual(runReplay(displayHz), reference)
})

test('Flying Lines declares the frozen same-build timing policy', () => {
	assert.equal(flyingLinesDefinition.stateVersion, 1)
	assert.equal(flyingLinesDefinition.timing.fixedStepSeconds, 1 / 120)
	assert.equal(flyingLinesDefinition.timing.deterministicTier, 'same-build-cpu')
	assert.equal(flyingLinesDefinition.timing.stateTolerance, 1e-9)
	assert.deepEqual(runReplay(60), runReplay(60))
})
