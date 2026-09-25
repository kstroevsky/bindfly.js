import assert from 'node:assert/strict'
import test from 'node:test'

import { InMemoryAuthoritativeRoom } from './in-memory-authority.ts'
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

test('authority orders concurrent inputs and replicas recover out-of-order delivery, duplicates and divergence', async () => {
	const authorityAdapter = createAdapter()
	const firstReplicaAdapter = createAdapter()
	const secondReplicaAdapter = createAdapter()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 1, adapter: authorityAdapter,
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
	assert.equal(authorityAdapter.read(), 5)

	assert.equal(firstReplica.receive(second.event).status, 'buffered-gap')
	assert.equal(firstReplicaAdapter.read(), 0)
	assert.equal(firstReplica.receive(first.event).status, 'applied')
	assert.equal(firstReplicaAdapter.read(), 5)
	assert.equal(firstReplica.receive(first.event).status, 'ignored-old')

	assert.equal(secondReplica.receive(first.event).status, 'applied')
	assert.equal(secondReplica.receive(second.event).status, 'applied')
	assert.equal(secondReplicaAdapter.read(), 5)

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
	})

	const malformed = room.submit(proposal('alice', 'bad', 0, Number.NaN))
	assert.deepEqual(malformed.ok ? undefined : malformed.code, 'INVALID_INPUT')

	const future = room.submit({ ...proposal('alice', 'future', 0, 1), protocolVersion: 99 })
	assert.deepEqual(future.ok ? undefined : future.code, 'PROTOCOL_VERSION_MISMATCH')

	const accepted = room.submit(proposal('alice', 'same-id', 0, 1))
	assert.equal(accepted.ok, true)
	const conflict = room.submit(proposal('alice', 'same-id', 1, 2))
	assert.deepEqual(conflict.ok ? undefined : conflict.code, 'IDEMPOTENCY_CONFLICT')
	assert.equal(adapter.read(), 1)
})
