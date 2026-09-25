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

const advanceCollaborativeStep = (
	room: InMemoryAuthoritativeRoom<ReturnType<typeof parseMovingPointInput>>,
	harnesses: readonly ReturnType<typeof createHarness>[],
	replicas: readonly CollaborationReplica<ReturnType<typeof parseMovingPointInput>>[],
	stepIndex: number,
) => {
	for (const harness of harnesses) stepSimulation(harness.simulation, stepIndex, stepIndex + 1)
	room.advanceStepIndex(stepIndex + 1)
	const tick = room.createTick()
	for (const replica of replicas) {
		assert.equal(replica.receiveTick(tick).ok, true)
		assert.equal(replica.advanceStepIndex(stepIndex + 1).ok, true)
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
	assert.equal(firstReplica.receive(added.event).status, 'buffered-step')
	assert.equal(firstReplica.receive(added.event).status, 'buffered-step')
	assert.equal(secondReplica.receive(added.event).status, 'buffered-step')
	assert.equal(secondReplica.receive(moved.event).status, 'buffered-step')
	assert.equal(authority.simulation.captureCheckpoint().particles.count, 3)
	assert.equal(first.simulation.captureCheckpoint().particles.count, 3)

	advanceCollaborativeStep(room, [authority, first, second], [firstReplica, secondReplica], 0)
	assert.equal(firstReplica.receive(added.event).status, 'ignored-old')
	assert.deepEqual(first.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
	assert.deepEqual(second.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())

	for (let stepIndex = 1; stepIndex < 12; stepIndex++) {
		advanceCollaborativeStep(room, [authority, first, second], [firstReplica, secondReplica], stepIndex)
	}

	second.simulation.applyInput({ type: 'move-point', id: 0, x: 500, y: 400 })
	const snapshot = await room.createSnapshot()
	assert.equal((await secondReplica.compareSnapshot(snapshot)).matches, false)
	assert.equal((await secondReplica.resynchronize(snapshot)).ok, true)
	assert.equal((await secondReplica.compareSnapshot(snapshot)).matches, true)

	const afterResync = room.submit(proposal('alice', 'add-after-resync', 2, { type: 'add-point', x: 320, y: 240 }))
	assert.equal(afterResync.ok, true)
	if (!afterResync.ok) return
	assert.equal(afterResync.event.stepIndex, 13)
	assert.equal(firstReplica.receive(afterResync.event).status, 'buffered-step')
	assert.equal(secondReplica.receive(afterResync.event).status, 'buffered-step')

	for (let stepIndex = 12; stepIndex < 22; stepIndex++) {
		advanceCollaborativeStep(room, [authority, first, second], [firstReplica, secondReplica], stepIndex)
	}
	assert.deepEqual(first.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
	assert.deepEqual(second.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
})

test('moving-point replica reconnects by replay, then by snapshot plus pending suffix, without losing RNG identity', async () => {
	const authority = createHarness()
	const connected = createHarness()
	const reconnecting = createHarness()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'shared-flying-lines', experimentId: 'flying-lines', stateVersion: 1, adapter: authority.adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
		maxReplayEvents: 1,
	})
	const connectedReplica = new CollaborationReplica({
		roomId: 'shared-flying-lines', experimentId: 'flying-lines', stateVersion: 1, adapter: connected.adapter,
	})
	const reconnectingReplica = new CollaborationReplica({
		roomId: 'shared-flying-lines', experimentId: 'flying-lines', stateVersion: 1, adapter: reconnecting.adapter,
	})

	const first = room.submit(proposal('alice', 'add-before-reconnect', 0, { type: 'add-point', x: 100, y: 120 }))
	assert.equal(first.ok, true)
	if (!first.ok) return
	assert.equal(connectedReplica.receive(first.event).status, 'buffered-step')

	stepSimulation(authority.simulation, 0, 1)
	stepSimulation(connected.simulation, 0, 1)
	room.advanceStepIndex(1)
	const firstTick = room.createTick()
	assert.equal(connectedReplica.receiveTick(firstTick).ok, true)
	assert.equal(connectedReplica.advanceStepIndex(1).ok, true)
	assert.equal(reconnectingReplica.receiveTick(firstTick).ok, true)
	assert.equal(reconnectingReplica.advanceStepIndex(1).ok, false)

	const replay = await room.createResumePlan({
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'shared-flying-lines',
		experimentId: 'flying-lines',
		stateVersion: 1,
		lastAppliedSequence: 0,
		stepIndex: 0,
	})
	assert.equal(replay.ok && replay.mode, 'replay')
	assert.equal((await reconnectingReplica.applyResumePlan(replay)).ok, true)
	assert.equal((await reconnectingReplica.applyResumePlan(replay)).ok, true)
	stepSimulation(reconnecting.simulation, 0, 1)
	assert.equal(reconnectingReplica.advanceStepIndex(1).ok, true)
	assert.deepEqual(reconnecting.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())

	const movedA = room.submit(proposal('alice', 'move-a', 1, { type: 'move-point', id: 0, x: 210, y: 190 }))
	const movedB = room.submit(proposal('bob', 'move-b', 1, { type: 'move-point', id: 1, x: 260, y: 220 }))
	assert.equal(movedA.ok, true)
	assert.equal(movedB.ok, true)
	if (!movedA.ok || !movedB.ok) return
	assert.equal(connectedReplica.receive(movedA.event).status, 'buffered-step')
	assert.equal(connectedReplica.receive(movedB.event).status, 'buffered-step')

	stepSimulation(authority.simulation, 1, 2)
	stepSimulation(connected.simulation, 1, 2)
	room.advanceStepIndex(2)
	assert.equal(connectedReplica.receiveTick(room.createTick()).ok, true)
	assert.equal(connectedReplica.advanceStepIndex(2).ok, true)

	const futureRandomInput = room.submit(proposal('alice', 'add-after-snapshot', 3, { type: 'add-point', x: 340, y: 280 }))
	assert.equal(futureRandomInput.ok, true)
	if (!futureRandomInput.ok) return
	assert.equal(futureRandomInput.event.stepIndex, 3)
	assert.equal(connectedReplica.receive(futureRandomInput.event).status, 'buffered-step')

	const snapshotPlan = await room.createResumePlan({
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'shared-flying-lines',
		experimentId: 'flying-lines',
		stateVersion: 1,
		lastAppliedSequence: reconnectingReplica.lastAppliedSequence,
		stepIndex: reconnectingReplica.currentStepIndex,
	})
	assert.equal(snapshotPlan.ok && snapshotPlan.mode, 'snapshot')
	if (!snapshotPlan.ok || snapshotPlan.mode !== 'snapshot') return
	assert.equal(snapshotPlan.snapshot.lastAppliedSequence, 3)
	assert.equal(snapshotPlan.events.length, 1)
	assert.equal(snapshotPlan.events[0]!.sequence, 4)
	assert.equal((await reconnectingReplica.applyResumePlan(snapshotPlan)).ok, true)
	assert.deepEqual(reconnecting.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())

	stepSimulation(authority.simulation, 2, 3)
	stepSimulation(connected.simulation, 2, 3)
	stepSimulation(reconnecting.simulation, 2, 3)
	room.advanceStepIndex(3)
	const finalTick = room.createTick()
	assert.equal(connectedReplica.receiveTick(finalTick).ok, true)
	assert.equal(reconnectingReplica.receiveTick(finalTick).ok, true)
	assert.equal(connectedReplica.advanceStepIndex(3).ok, true)
	assert.equal(reconnectingReplica.advanceStepIndex(3).ok, true)
	assert.deepEqual(connected.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
	assert.deepEqual(reconnecting.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
})
