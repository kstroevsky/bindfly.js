import assert from 'node:assert/strict'
import test from 'node:test'

import { createSnapshotChecksum, encodeCanonicalSnapshotV1 } from './canonical-snapshot.ts'
import { COLLABORATION_PROTOCOL_VERSION } from './protocol.ts'
import {
	COLLABORATION_WIRE_VERSION,
	encodeClientCollaborationWireMessage,
	encodeServerCollaborationWireMessage,
	parseClientCollaborationWireMessage,
	parseServerCollaborationWireMessage,
} from './wire.ts'

test('collaboration wire round-trips snapshot bytes without changing cryptographic identity', async () => {
	const configurationBytes = new Uint8Array([0, 1, 2, 127, 128, 255])
	const stateBytes = new Uint8Array([255, 0, 42, 17, 99])
	const canonicalBytes = encodeCanonicalSnapshotV1({
		roomId: 'room-wire',
		experimentId: 'fixture',
		stateVersion: 1,
		lastAppliedSequence: 7,
		stepIndex: 11,
		configurationBytes,
		stateBytes,
	})
	const snapshot = {
		protocolVersion: COLLABORATION_PROTOCOL_VERSION,
		roomId: 'room-wire',
		experimentId: 'fixture',
		stateVersion: 1,
		lastAppliedSequence: 7,
		stepIndex: 11,
		configurationBytes,
		stateBytes,
		checksum: await createSnapshotChecksum(canonicalBytes),
	} as const
	const encoded = encodeServerCollaborationWireMessage({
		wireVersion: COLLABORATION_WIRE_VERSION,
		type: 'resume-plan',
		plan: {
			ok: true,
			mode: 'snapshot',
			snapshot,
			events: [],
			tick: {
				protocolVersion: COLLABORATION_PROTOCOL_VERSION,
				roomId: 'room-wire',
				experimentId: 'fixture',
				stateVersion: 1,
				stepIndex: 11,
				logHeadSequence: 7,
				appliedSequence: 7,
			},
		},
	})
	assert.equal(encoded.includes('configurationBytes'), false)
	assert.equal(encoded.includes('configurationBase64Url'), true)

	const decoded = parseServerCollaborationWireMessage(encoded)
	assert.equal(decoded.ok, true)
	if (!decoded.ok || decoded.value.type !== 'resume-plan' || !decoded.value.plan.ok || decoded.value.plan.mode !== 'snapshot') return
	assert.deepEqual(decoded.value.plan.snapshot.configurationBytes, configurationBytes)
	assert.deepEqual(decoded.value.plan.snapshot.stateBytes, stateBytes)
	assert.deepEqual(decoded.value.plan.snapshot.checksum, snapshot.checksum)
})

test('client wire parser preserves semantic protocol errors for the authority', () => {
	const message = encodeClientCollaborationWireMessage({
		wireVersion: COLLABORATION_WIRE_VERSION,
		type: 'submit',
		proposal: {
			protocolVersion: 99,
			roomId: 'room-wire',
			participantId: 'alice',
			clientEventId: 'future-version',
			knownSequence: -1,
			input: { type: 'add-point', x: 1, y: 2 },
		},
	})
	const parsed = parseClientCollaborationWireMessage(message)
	assert.equal(parsed.ok, true)
	if (!parsed.ok || parsed.value.type !== 'submit') return
	assert.equal(parsed.value.proposal.protocolVersion, 99)
	assert.equal(parsed.value.proposal.knownSequence, -1)
})

test('wire parser rejects malformed envelopes and malformed encoded snapshot bytes', () => {
	assert.equal(parseClientCollaborationWireMessage('{').ok, false)
	assert.equal(parseClientCollaborationWireMessage(JSON.stringify({ wireVersion: 99, type: 'resume' })).ok, false)

	const malformed = parseServerCollaborationWireMessage(JSON.stringify({
		wireVersion: COLLABORATION_WIRE_VERSION,
		type: 'resume-plan',
		plan: {
			ok: true,
			mode: 'snapshot',
			snapshot: {
				protocolVersion: COLLABORATION_PROTOCOL_VERSION,
				roomId: 'room-wire',
				experimentId: 'fixture',
				stateVersion: 1,
				lastAppliedSequence: 0,
				stepIndex: 0,
				configurationBase64Url: '%',
				stateBase64Url: '',
				checksum: { algorithm: 'sha-256', encodingVersion: 1, value: '0'.repeat(64) },
			},
			events: [],
			tick: {
				protocolVersion: COLLABORATION_PROTOCOL_VERSION,
				roomId: 'room-wire',
				experimentId: 'fixture',
				stateVersion: 1,
				stepIndex: 0,
				logHeadSequence: 0,
				appliedSequence: 0,
			},
		},
	}))
	assert.equal(malformed.ok, false)
})
