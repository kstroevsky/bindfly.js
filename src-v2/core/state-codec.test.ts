import assert from 'node:assert/strict'
import test from 'node:test'

import {
	createVersionedStateEnvelope,
	parseVersionedStateEnvelope,
} from './state-codec.ts'

test('creates and parses a versioned state envelope', () => {
	const envelope = createVersionedStateEnvelope({
		experimentId: 'flying-lines',
		stateVersion: 1,
		payload: { particles: 100 },
	})

	assert.deepEqual(parseVersionedStateEnvelope(envelope), {
		ok: true,
		value: envelope,
	})
})

test('rejects malformed state without partial decoding', () => {
	assert.deepEqual(
		parseVersionedStateEnvelope({
			experimentId: 'flying-lines',
			stateVersion: 0,
		}),
		{
			ok: false,
			error: 'State envelope must include a positive integer stateVersion and a payload.',
		},
	)
})
