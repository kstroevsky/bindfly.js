import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import {
	createSnapshotChecksum,
	encodeCanonicalSnapshotV1,
} from './canonical-snapshot.ts'

test('snapshot checksum v1 is SHA-256 over the explicitly encoded canonical snapshot bytes', async () => {
	const bytes = encodeCanonicalSnapshotV1({
		roomId: 'room-1',
		experimentId: 'fixture',
		stateVersion: 3,
		lastSequence: 7,
		stepIndex: 11,
		configurationBytes: new Uint8Array([1, 2, 3]),
		stateBytes: new Uint8Array([4, 5, 6, 7]),
	})
	const checksum = await createSnapshotChecksum(bytes)

	assert.equal(checksum.algorithm, 'sha-256')
	assert.equal(checksum.encodingVersion, 1)
	assert.equal(checksum.value, createHash('sha256').update(bytes).digest('hex'))

	const changed = await createSnapshotChecksum(encodeCanonicalSnapshotV1({
		roomId: 'room-1', experimentId: 'fixture', stateVersion: 3,
		lastSequence: 8, stepIndex: 11,
		configurationBytes: new Uint8Array([1, 2, 3]), stateBytes: new Uint8Array([4, 5, 6, 7]),
	}))
	assert.notEqual(changed.value, checksum.value)
})
