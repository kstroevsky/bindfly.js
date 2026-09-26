import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom, createViewport } from '../../core/index.ts'
import {
	decodeMovingPointCheckpointV1,
	encodeMovingPointCheckpointV1,
} from './checkpoint.ts'
import { createMovingPointSimulation } from './simulation.ts'

const parameters = {
	particleCount: 2,
	maxSpeed: 60,
	particleLifetimeSeconds: 20,
	margin: 20,
}

const createSimulation = () => createMovingPointSimulation({
	environment: {
		random: createSeededRandom('collaboration-checkpoint'),
		viewport: createViewport({ cssWidth: 640, cssHeight: 480, devicePixelRatio: 1 }),
	},
	parameters,
})

test('moving-point checkpoints restore RNG and ID allocation as well as visible particle state', () => {
	const authority = createSimulation()
	authority.step({ index: 0, dtSeconds: 1 / 120, elapsedSeconds: 1 / 120 })
	authority.applyInput({ type: 'add-point', x: 100, y: 120 })

	const encoded = encodeMovingPointCheckpointV1(authority.captureCheckpoint())
	const decoded = decodeMovingPointCheckpointV1(encoded)
	const replica = createSimulation()
	replica.applyInput({ type: 'add-point', x: 400, y: 300 })
	replica.step({ index: 0, dtSeconds: 0.5, elapsedSeconds: 0.5 })
	replica.restoreCheckpoint(decoded)

	assert.deepEqual(replica.captureCheckpoint(), authority.captureCheckpoint())

	authority.applyInput({ type: 'add-point', x: 220, y: 180 })
	replica.applyInput({ type: 'add-point', x: 220, y: 180 })
	assert.deepEqual(replica.captureCheckpoint(), authority.captureCheckpoint())
})
