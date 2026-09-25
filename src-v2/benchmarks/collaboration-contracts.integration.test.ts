import assert from 'node:assert/strict'
import test from 'node:test'

import { CollaborationReplica, COLLABORATION_PROTOCOL_VERSION, InMemoryAuthoritativeRoom } from '../collaboration/index.ts'
import { createSeededRandom, createViewport } from '../core/index.ts'
import {
	decodeMovingPointCheckpointV1,
	encodeMovingPointCheckpointV1,
	encodeMovingPointInputV1,
	parseMovingPointInput,
} from '../effects/index.ts'
import { createMovingPointSimulation } from '../effects/moving-points/simulation.ts'

const parameters = {
	particleCount: 3,
	maxSpeed: 80,
	particleLifetimeSeconds: 15,
	margin: 20,
}
const viewport = createViewport({ cssWidth: 640, cssHeight: 480, devicePixelRatio: 1 })
const configurationBytes = new TextEncoder().encode('flying-lines-collaboration-fixture-v1')

const createHarness = () => {
	const simulation = createMovingPointSimulation({
		environment: { random: createSeededRandom('shared-room-seed'), viewport },
		parameters,
	})
	return {
		simulation,
		adapter: {
			parseInput: (value: unknown) => {
				try { return { ok: true as const, value: parseMovingPointInput(value) } } catch (error) {
					return { ok: false as const, error: error instanceof Error ? error.message : 'Invalid moving-point input.' }
				}
			},
			encodeInput: encodeMovingPointInputV1,
			applyInput: (input: ReturnType<typeof parseMovingPointInput>) => simulation.applyInput(input),
			captureConfigurationBytes: () => configurationBytes.slice(),
			captureStateBytes: () => encodeMovingPointCheckpointV1(simulation.captureCheckpoint()),
			restoreStateBytes: (bytes: Uint8Array) => simulation.restoreCheckpoint(decodeMovingPointCheckpointV1(bytes)),
		},
	}
}

const proposal = (participantId: string, clientEventId: string, knownSequence: number, input: unknown) => ({
	protocolVersion: COLLABORATION_PROTOCOL_VERSION,
	roomId: 'shared-flying-lines',
	participantId,
	clientEventId,
	knownSequence,
	input,
})

const stepSimulation = (simulation: ReturnType<typeof createMovingPointSimulation>, from: number, to: number) => {
	for (let index = from; index < to; index++) {
		simulation.step({ index, dtSeconds: 1 / 120, elapsedSeconds: (index + 1) / 120 })
	}
}

test('two deterministic moving-point replicas recover ordering and forced divergence without losing future RNG identity', async () => {
	const authority = createHarness()
	const first = createHarness()
	const second = createHarness()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'shared-flying-lines', experimentId: 'flying-lines', stateVersion: 1, adapter: authority.adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
	})
	const firstReplica = new CollaborationReplica({
		roomId: 'shared-flying-lines', experimentId: 'flying-lines', stateVersion: 1, adapter: first.adapter,
	})
	const secondReplica = new CollaborationReplica({
		roomId: 'shared-flying-lines', experimentId: 'flying-lines', stateVersion: 1, adapter: second.adapter,
	})

	const added = room.submit(proposal('alice', 'add-1', 0, { type: 'add-point', x: 120, y: 160 }))
	assert.equal(added.ok, true)
	if (!added.ok) return
	const moved = room.submit(proposal('bob', 'move-1', 0, { type: 'move-point', id: 0, x: 250, y: 210 }))
	assert.equal(moved.ok, true)
	if (!moved.ok) return

	assert.equal(firstReplica.receive(moved.event).status, 'buffered-gap')
	assert.equal(firstReplica.receive(added.event).status, 'applied')
	assert.equal(firstReplica.receive(added.event).status, 'ignored-old')
	assert.equal(secondReplica.receive(added.event).status, 'applied')
	assert.equal(secondReplica.receive(moved.event).status, 'applied')
	assert.deepEqual(first.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
	assert.deepEqual(second.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())

	stepSimulation(authority.simulation, 0, 12)
	stepSimulation(first.simulation, 0, 12)
	stepSimulation(second.simulation, 0, 12)
	room.advanceStepIndex(12)
	assert.equal(firstReplica.advanceStepIndex(12).ok, true)
	assert.equal(secondReplica.advanceStepIndex(12).ok, true)

	second.simulation.applyInput({ type: 'move-point', id: 0, x: 500, y: 400 })
	const snapshot = await room.createSnapshot()
	assert.equal((await secondReplica.compareSnapshot(snapshot)).matches, false)
	assert.equal((await secondReplica.resynchronize(snapshot)).ok, true)
	assert.equal((await secondReplica.compareSnapshot(snapshot)).matches, true)

	const afterResync = room.submit(proposal('alice', 'add-after-resync', 2, { type: 'add-point', x: 320, y: 240 }))
	assert.equal(afterResync.ok, true)
	if (!afterResync.ok) return
	assert.equal(firstReplica.receive(afterResync.event).status, 'applied')
	assert.equal(secondReplica.receive(afterResync.event).status, 'applied')
	assert.deepEqual(first.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
	assert.deepEqual(second.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())

	stepSimulation(authority.simulation, 12, 22)
	stepSimulation(first.simulation, 12, 22)
	stepSimulation(second.simulation, 12, 22)
	room.advanceStepIndex(22)
	assert.equal(firstReplica.advanceStepIndex(22).ok, true)
	assert.equal(secondReplica.advanceStepIndex(22).ok, true)
	assert.deepEqual(first.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
	assert.deepEqual(second.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
})
