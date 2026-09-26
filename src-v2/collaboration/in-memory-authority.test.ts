import assert from 'node:assert/strict'
import test from 'node:test'

import { InMemoryAuthoritativeRoom } from './in-memory-authority.ts'
import { createEventLogHeadHash } from './persistence-integrity.ts'
import { CollaborationReplica } from './replica.ts'
import { COLLABORATION_PROTOCOL_VERSION } from './protocol.ts'

const numberBytes = (value: number): Uint8Array => {
	const bytes = new Uint8Array(8)
	new DataView(bytes.buffer).setFloat64(0, value, false)
	return bytes
}

const numberFromBytes = (bytes: Uint8Array): number => {
	if (bytes.byteLength !== 8) throw new Error('Fixture state must contain one Float64.')
	return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat64(0, false)
}

const createAdapter = () => {
	let state = 0
	return {
		parseInput: (value: unknown) => typeof value === 'number' && Number.isFinite(value)
			? { ok: true as const, value }
			: { ok: false as const, error: 'delta must be finite' },
		encodeInput: numberBytes,
		decodeInput: (bytes: Uint8Array) => {
			try { return { ok: true as const, value: numberFromBytes(bytes) } } catch (error) {
				return { ok: false as const, error: error instanceof Error ? error.message : 'invalid fixture input' }
			}
		},
		applyInput: (delta: number) => { state += delta },
		captureConfigurationBytes: () => new Uint8Array([9, 9]),
		captureStateBytes: () => numberBytes(state),
		restoreStateBytes: (bytes: Uint8Array) => { state = numberFromBytes(bytes) },
		read: () => state,
		diverge: (delta: number) => { state += delta },
	}
}

const proposal = (participantId: string, clientEventId: string, knownSequence: number, input: unknown) => ({
	protocolVersion: COLLABORATION_PROTOCOL_VERSION,
	roomId: 'room-1',
	participantId,
	clientEventId,
	knownSequence,
	input,
})

const allowAll = () => ({ ok: true as const, value: undefined })

test('authority orders concurrent inputs and replicas recover out-of-order delivery, duplicates and divergence', async () => {
	const authorityAdapter = createAdapter()
	const firstReplicaAdapter = createAdapter()
	const secondReplicaAdapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: authorityAdapter, authorizeInput: allowAll,
	})
	const firstReplica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: firstReplicaAdapter,
	})
	const secondReplica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: secondReplicaAdapter,
	})

	const first = room.submit(proposal('alice', 'event-a', 0, 2))
	assert.equal(first.ok, true)
	if (!first.ok) return
	const second = room.submit(proposal('bob', 'event-b', 0, 3))
	assert.equal(second.ok, true)
	if (!second.ok) return
	assert.equal(first.event.sequence, 1)
	assert.equal(second.event.sequence, 2)
	assert.equal(first.event.stepIndex, 1)
	assert.equal(second.event.stepIndex, 1)
	assert.equal(authorityAdapter.read(), 0)
	assert.deepEqual(room.createTick(), {
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'room-1',
		experimentId: 'fixture',
		stateVersion: 1,
		stepIndex: 0,
		logHeadSequence: 2,
		appliedSequence: 0,
	})

	assert.equal(firstReplica.receive(second.event).status, 'buffered-gap')
	assert.equal(firstReplicaAdapter.read(), 0)
	assert.equal(firstReplica.receive(first.event).status, 'buffered-step')
	assert.equal(firstReplicaAdapter.read(), 0)

	assert.equal(secondReplica.receive(first.event).status, 'buffered-step')
	assert.equal(secondReplica.receive(second.event).status, 'buffered-step')
	assert.equal(secondReplicaAdapter.read(), 0)

	room.advanceStepIndex(1)
	const tick = room.createTick()
	assert.equal(authorityAdapter.read(), 5)
	assert.equal(tick.appliedSequence, 2)
	assert.equal(firstReplica.receiveTick(tick).ok, true)
	assert.equal(secondReplica.receiveTick(tick).ok, true)
	assert.equal(firstReplica.advanceStepIndex(1).ok, true)
	assert.equal(secondReplica.advanceStepIndex(1).ok, true)
	assert.equal(firstReplicaAdapter.read(), 5)
	assert.equal(secondReplicaAdapter.read(), 5)
	assert.equal(firstReplica.receive(first.event).status, 'ignored-old')

	const retry = room.submit(proposal('alice', 'event-a', 0, 2))
	assert.equal(retry.ok, true)
	if (!retry.ok) return
	assert.equal(retry.duplicate, true)
	assert.equal(room.eventLog.length, 2)

	secondReplicaAdapter.diverge(10)
	const snapshot = await room.createSnapshot()
	const evidence = await secondReplica.compareSnapshot(snapshot)
	assert.equal(evidence.matches, false)
	assert.notEqual(evidence.replicaChecksum.value, evidence.authoritativeChecksum.value)

	const resync = await secondReplica.resynchronize(snapshot)
	assert.equal(resync.ok, true)
	assert.equal(secondReplicaAdapter.read(), 5)
	assert.equal((await secondReplica.compareSnapshot(snapshot)).matches, true)
})

test('authority rejects malformed, future-version and conflicting idempotency input without mutating state', () => {
	const adapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter,
		authorizeInput: (participantId) => participantId === 'blocked'
			? { ok: false as const, error: 'participant is blocked' }
			: allowAll(),
	})

	const malformed = room.submit(proposal('alice', 'bad', 0, Number.NaN))
	assert.deepEqual(malformed.ok ? undefined : malformed.code, 'INVALID_INPUT')

	const future = room.submit({ ...proposal('alice', 'future', 0, 1), protocolVersion: 99 })
	assert.deepEqual(future.ok ? undefined : future.code, 'PROTOCOL_VERSION_MISMATCH')
	const unauthorized = room.submit(proposal('blocked', 'denied', 0, 1))
	assert.deepEqual(unauthorized.ok ? undefined : unauthorized.code, 'UNAUTHORIZED')

	const accepted = room.submit(proposal('alice', 'same-id', 0, 1))
	assert.equal(accepted.ok, true)
	const conflict = room.submit(proposal('alice', 'same-id', 1, 2))
	assert.deepEqual(conflict.ok ? undefined : conflict.code, 'IDEMPOTENCY_CONFLICT')
	assert.equal(adapter.read(), 0)
	room.advanceStepIndex(1)
	assert.equal(adapter.read(), 1)
})

test('authority rate limit counts accepted inputs per participant and authoritative step without penalizing retries', () => {
	const adapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter, authorizeInput: allowAll,
		maxInputsPerParticipantPerStep: 1,
	})
	const first = room.submit(proposal('alice', 'event-a', 0, 1))
	assert.equal(first.ok, true)
	const retry = room.submit(proposal('alice', 'event-a', 0, 1))
	assert.equal(retry.ok && retry.duplicate, true)
	const limited = room.submit(proposal('alice', 'event-b', 0, 2))
	assert.deepEqual(limited.ok ? undefined : limited.code, 'RATE_LIMIT_EXCEEDED')
	assert.equal(room.submit(proposal('bob', 'event-c', 0, 3)).ok, true)

	room.advanceStepIndex(1)
	assert.equal(room.submit(proposal('alice', 'event-d', 2, 4)).ok, true)
})

test('idempotent retry returns the committed outcome after participant authorization is revoked', () => {
	const adapter = createAdapter()
	let authorized = true
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter,
		authorizeInput: () => authorized ? allowAll() : { ok: false as const, error: 'revoked' },
	})
	const accepted = room.submit(proposal('alice', 'event-a', 0, 2))
	assert.equal(accepted.ok, true)
	if (!accepted.ok) return
	authorized = false
	const retry = room.submit(proposal('alice', 'event-a', 1, 2))
	assert.equal(retry.ok && retry.duplicate, true)
	if (retry.ok) assert.equal(retry.event.sequence, accepted.event.sequence)
	const newInput = room.submit(proposal('alice', 'event-b', 1, 3))
	assert.deepEqual(newInput.ok ? undefined : newInput.code, 'UNAUTHORIZED')
})

test('replica rejects a tampered authoritative snapshot before restoring state', async () => {
	const authorityAdapter = createAdapter()
	const replicaAdapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: authorityAdapter, authorizeInput: allowAll,
	})
	const replica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: replicaAdapter,
	})
	const accepted = room.submit(proposal('alice', 'event-a', 0, 2))
	assert.equal(accepted.ok, true)
	if (!accepted.ok) return
	room.advanceStepIndex(1)
	replica.receive(accepted.event)
	assert.equal(replica.receiveTick(room.createTick()).ok, true)
	assert.equal(replica.advanceStepIndex(1).ok, true)
	const snapshot = await room.createSnapshot()
	const tampered = { ...snapshot, stateBytes: snapshot.stateBytes.slice() }
	tampered.stateBytes[0] ^= 0xff

	const result = await replica.resynchronize(tampered)
	assert.equal(result.ok, false)
	assert.match(result.ok ? '' : result.error, /checksum verification failed/)
	assert.equal(replicaAdapter.read(), 2)
})

test('authoritative tick prevents a replica from crossing a boundary while an accepted event is missing', () => {
	const authorityAdapter = createAdapter()
	const replicaAdapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: authorityAdapter, authorizeInput: allowAll,
	})
	const replica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: replicaAdapter,
	})
	const accepted = room.submit(proposal('alice', 'event-a', 0, 2))
	assert.equal(accepted.ok, true)
	if (!accepted.ok) return
	room.advanceStepIndex(1)
	assert.equal(replica.receiveTick(room.createTick()).ok, true)
	const blocked = replica.advanceStepIndex(1)
	assert.equal(blocked.ok, false)
	assert.match(blocked.ok ? '' : blocked.error, /events are missing/)
	assert.equal(replicaAdapter.read(), 0)
	assert.equal(replica.receive(accepted.event).status, 'buffered-step')
	assert.equal(replica.advanceStepIndex(1).ok, true)
	assert.equal(replicaAdapter.read(), 2)
})

test('replica rejects a tick that claims an event was applied before its scheduled boundary', () => {
	const adapter = createAdapter()
	const replica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter,
	})
	const event = {
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'room-1',
		experimentId: 'fixture',
		stateVersion: 1,
		participantId: 'alice',
		clientEventId: 'event-a',
		sequence: 1,
		stepIndex: 2,
		input: 2,
	} as const
	assert.equal(replica.receive(event).status, 'buffered-step')
	const tick = replica.receiveTick({
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'room-1',
		experimentId: 'fixture',
		stateVersion: 1,
		stepIndex: 1,
		logHeadSequence: 1,
		appliedSequence: 1,
	})
	assert.equal(tick.ok, false)
	assert.match(tick.ok ? '' : tick.error, /before its scheduled boundary/)
	assert.equal(adapter.read(), 0)
})

test('snapshot identity covers only events already applied to authoritative state', async () => {
	const adapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter, authorizeInput: allowAll,
	})
	const accepted = room.submit(proposal('alice', 'event-a', 0, 2))
	assert.equal(accepted.ok, true)
	if (!accepted.ok) return

	const beforeApply = await room.createSnapshot()
	assert.equal(beforeApply.lastAppliedSequence, 0)
	assert.equal(numberFromBytes(beforeApply.stateBytes), 0)
	assert.equal(room.createTick().logHeadSequence, 1)
	assert.equal(room.createTick().appliedSequence, 0)

	room.advanceStepIndex(1)
	const afterApply = await room.createSnapshot()
	assert.equal(afterApply.lastAppliedSequence, 1)
	assert.equal(numberFromBytes(afterApply.stateBytes), 2)
})

test('resume replays a compatible suffix and falls back to snapshot plus pending events when replay is too stale', async () => {
	const authorityAdapter = createAdapter()
	const replayAdapter = createAdapter()
	const snapshotAdapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: authorityAdapter, authorizeInput: allowAll,
		maxReplayEvents: 2,
	})
	const replayReplica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: replayAdapter,
	})
	const snapshotReplica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: snapshotAdapter,
	})

	assert.equal(room.submit(proposal('alice', 'event-a', 0, 2)).ok, true)
	assert.equal(room.submit(proposal('bob', 'event-b', 0, 3)).ok, true)
	room.advanceStepIndex(1)

	const replay = await room.createResumePlan({
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'room-1',
		experimentId: 'fixture',
		stateVersion: 1,
		lastAppliedSequence: 0,
		stepIndex: 0,
	})
	assert.equal(replay.ok && replay.mode, 'replay')
	assert.equal(await replayReplica.applyResumePlan(replay).then((result) => result.ok), true)
	assert.equal(replayReplica.advanceStepIndex(1).ok, true)
	assert.equal(replayAdapter.read(), 5)

	const future = room.submit(proposal('alice', 'event-c', 2, 4))
	assert.equal(future.ok, true)
	if (!future.ok) return
	assert.equal(future.event.stepIndex, 2)
	const staleRoom = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: createAdapter(), authorizeInput: allowAll,
		maxReplayEvents: 0,
	})
	assert.equal(staleRoom.submit(proposal('alice', 'event-a', 0, 2)).ok, true)
	assert.equal(staleRoom.submit(proposal('bob', 'event-b', 0, 3)).ok, true)
	staleRoom.advanceStepIndex(1)
	const staleFuture = staleRoom.submit(proposal('alice', 'event-c', 2, 4))
	assert.equal(staleFuture.ok, true)

	const snapshotPlan = await staleRoom.createResumePlan({
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'room-1',
		experimentId: 'fixture',
		stateVersion: 1,
		lastAppliedSequence: 0,
		stepIndex: 0,
	})
	assert.equal(snapshotPlan.ok && snapshotPlan.mode, 'snapshot')
	if (!snapshotPlan.ok || snapshotPlan.mode !== 'snapshot') return
	assert.equal(snapshotPlan.snapshot.lastAppliedSequence, 2)
	assert.equal(snapshotPlan.events.length, 1)
	assert.equal(snapshotPlan.events[0]!.sequence, 3)
	assert.equal(await snapshotReplica.applyResumePlan(snapshotPlan).then((result) => result.ok), true)
	assert.equal(snapshotAdapter.read(), 5)
	assert.equal(snapshotReplica.currentStepIndex, 1)

	staleRoom.advanceStepIndex(2)
	assert.equal(snapshotReplica.receiveTick(staleRoom.createTick()).ok, true)
	assert.equal(snapshotReplica.advanceStepIndex(2).ok, true)
	assert.equal(snapshotAdapter.read(), 9)
})

test('resume bounds simulation catch-up by maxReplaySteps even when no events are missing', async () => {
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: createAdapter(), authorizeInput: allowAll,
		maxReplaySteps: 2,
	})
	room.advanceStepIndex(1)
	room.advanceStepIndex(2)
	room.advanceStepIndex(3)
	const plan = await room.createResumePlan({
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'room-1',
		experimentId: 'fixture',
		stateVersion: 1,
		lastAppliedSequence: 0,
		stepIndex: 0,
	})
	assert.equal(plan.ok && plan.mode, 'snapshot')
	if (plan.ok && plan.mode === 'snapshot') assert.equal(plan.snapshot.stepIndex, 3)
})

test('historical sync points validate replay bases and connected replicas detect divergence', async () => {
	const authorityAdapter = createAdapter()
	const replicaAdapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: authorityAdapter, authorizeInput: allowAll,
	})
	const replica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: replicaAdapter,
	})
	const accepted = room.submit(proposal('alice', 'event-a', 0, 2))
	assert.equal(accepted.ok, true)
	if (!accepted.ok) return
	assert.equal(replica.receive(accepted.event).status, 'buffered-step')
	room.advanceStepIndex(1)
	const syncPoint = await room.createSyncPoint()
	assert.equal(replica.receiveTick(room.createTick(syncPoint)).ok, true)
	assert.equal(replica.advanceStepIndex(1).ok, true)
	const verified = await replica.verifyPendingSyncPoint()
	assert.equal(verified.ok && verified.value?.matches, true)
	const verifiedBase = await replica.createResumeRequest()

	room.advanceStepIndex(2)
	const replay = await room.createResumePlan(verifiedBase)
	assert.equal(replay.ok && replay.mode, 'replay')

	replicaAdapter.diverge(5)
	const divergentBase = await replica.createResumeRequest()
	const snapshot = await room.createResumePlan(divergentBase)
	assert.equal(snapshot.ok && snapshot.mode, 'snapshot')

	const divergentReplicaAdapter = createAdapter()
	const divergentReplica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: divergentReplicaAdapter,
	})
	assert.equal(divergentReplica.receive(accepted.event).status, 'buffered-step')
	assert.equal(divergentReplica.receiveTick(room.createTick()).ok, true)
	assert.equal(divergentReplica.advanceStepIndex(1).ok, true)
	divergentReplicaAdapter.diverge(1)
	assert.equal(divergentReplica.receiveTick({ ...room.createTick(), stepIndex: 1, syncPoint }).ok, false)

	const activeReplicaAdapter = createAdapter()
	const activeReplica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: activeReplicaAdapter,
	})
	assert.equal(activeReplica.receive(accepted.event).status, 'buffered-step')
	assert.equal(activeReplica.receiveTick({
		...room.createTick(),
		stepIndex: 1,
		logHeadSequence: 1,
		appliedSequence: 1,
		syncPoint,
	}).ok, true)
	assert.equal(activeReplica.advanceStepIndex(1).ok, true)
	activeReplicaAdapter.diverge(1)
	const mismatch = await activeReplica.verifyPendingSyncPoint()
	assert.equal(mismatch.ok && mismatch.value?.matches, false)
	assert.equal(activeReplica.requiresResynchronization, true)
})

test('resume rejects incompatible protocol and state identity', async () => {
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: createAdapter(), authorizeInput: allowAll,
	})
	const base = {
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'room-1',
		experimentId: 'fixture',
		stateVersion: 1,
		lastAppliedSequence: 0,
		stepIndex: 0,
	}
	const protocol = await room.createResumePlan({ ...base, protocolVersion: 99 })
	assert.deepEqual(protocol.ok ? undefined : protocol.code, 'PROTOCOL_VERSION_MISMATCH')
	const state = await room.createResumePlan({ ...base, stateVersion: 2 })
	assert.deepEqual(state.ok ? undefined : state.code, 'STATE_VERSION_MISMATCH')
})

test('resume uses a current-state checksum mismatch to force authoritative snapshot recovery', async () => {
	const authorityAdapter = createAdapter()
	const replicaAdapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: authorityAdapter, authorizeInput: allowAll,
	})
	const replica = new CollaborationReplica({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: replicaAdapter,
	})
	const accepted = room.submit(proposal('alice', 'event-a', 0, 2))
	assert.equal(accepted.ok, true)
	if (!accepted.ok) return
	assert.equal(replica.receive(accepted.event).status, 'buffered-step')
	room.advanceStepIndex(1)
	assert.equal(replica.receiveTick(room.createTick()).ok, true)
	assert.equal(replica.advanceStepIndex(1).ok, true)

	replicaAdapter.diverge(10)
	const snapshot = await room.createSnapshot()
	const evidence = await replica.compareSnapshot(snapshot)
	assert.equal(evidence.matches, false)
	const plan = await room.createResumePlan({
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'room-1',
		experimentId: 'fixture',
		stateVersion: 1,
		lastAppliedSequence: replica.lastAppliedSequence,
		stepIndex: replica.currentStepIndex,
		checksum: evidence.replicaChecksum,
	})
	assert.equal(plan.ok && plan.mode, 'snapshot')
	assert.equal((await replica.applyResumePlan(plan)).ok, true)
	assert.equal(replicaAdapter.read(), 2)
})

test('authoritative persistence recovers applied state, pending events, idempotency and current-step rate usage', async () => {
	const firstAdapter = createAdapter()
	const firstRoom = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: firstAdapter, authorizeInput: allowAll,
		maxInputsPerParticipantPerStep: 2,
	})
	assert.equal(firstRoom.submit(proposal('alice', 'event-a', 0, 2)).ok, true)
	firstRoom.advanceStepIndex(1)
	assert.equal(firstRoom.submit(proposal('alice', 'event-b', 1, 3)).ok, true)
	assert.equal(firstRoom.submit(proposal('alice', 'event-c', 2, 4)).ok, true)
	const persisted = await firstRoom.capturePersistenceState()

	const recoveredAdapter = createAdapter()
	const recoveredRoom = await InMemoryAuthoritativeRoom.recover({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: recoveredAdapter, authorizeInput: allowAll,
		maxInputsPerParticipantPerStep: 2,
	}, persisted)
	assert.equal(recoveredAdapter.read(), 2)
	assert.equal(recoveredRoom.currentStepIndex, 1)
	assert.equal(recoveredRoom.appliedSequence, 1)
	assert.equal(recoveredRoom.logHeadSequence, 3)
	const retry = recoveredRoom.submit(proposal('alice', 'event-c', 3, 4))
	assert.equal(retry.ok && retry.duplicate, true)
	const limited = recoveredRoom.submit(proposal('alice', 'event-d', 3, 5))
	assert.deepEqual(limited.ok ? undefined : limited.code, 'RATE_LIMIT_EXCEEDED')
	recoveredRoom.advanceStepIndex(2)
	assert.equal(recoveredAdapter.read(), 9)
	await assert.rejects(
		InMemoryAuthoritativeRoom.recover({
			roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: createAdapter(), authorizeInput: allowAll,
			inputLeadSteps: 2,
		}, persisted),
		/input scheduling policy/,
	)
})

test('authoritative persistence rejects tampered snapshots and invalid persisted input bytes', async () => {
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: createAdapter(), authorizeInput: allowAll,
	})
	assert.equal(room.submit(proposal('alice', 'event-a', 0, 2)).ok, true)
	room.advanceStepIndex(1)
	const persisted = await room.capturePersistenceState()
	const tamperedSnapshot = {
		...persisted,
		snapshot: { ...persisted.snapshot, stateBytes: persisted.snapshot.stateBytes.slice() },
	}
	tamperedSnapshot.snapshot.stateBytes[0] ^= 0xff
	await assert.rejects(
		InMemoryAuthoritativeRoom.recover({
			roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: createAdapter(), authorizeInput: allowAll,
		}, tamperedSnapshot),
		/checksum verification failed/,
	)

	const invalidEvents = persisted.events.map((event, index) => index === 0
		? { ...event, inputBytes: new Uint8Array([...event.inputBytes, 0]) }
		: event)
	const invalidInput = {
		...persisted,
		events: invalidEvents,
		eventLogHeadHash: await createEventLogHeadHash(invalidEvents),
	}
	await assert.rejects(
		InMemoryAuthoritativeRoom.recover({
			roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: createAdapter(), authorizeInput: allowAll,
		}, invalidInput),
		/input is invalid/,
	)

	const validButWrongEvents = persisted.events.map((event, index) => index === 0
		? { ...event, inputBytes: numberBytes(999) }
		: event)
	await assert.rejects(
		InMemoryAuthoritativeRoom.recover({
			roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: createAdapter(), authorizeInput: allowAll,
		}, { ...persisted, events: validButWrongEvents }),
		/event-log integrity verification failed/,
	)
})
