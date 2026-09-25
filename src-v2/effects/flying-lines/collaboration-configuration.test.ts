import assert from 'node:assert/strict'
import test from 'node:test'

import {
	decodeFlyingLinesCollaborationConfigurationV1,
	encodeFlyingLinesCollaborationConfigurationV1,
} from './collaboration-configuration.ts'

const configuration = {
	seed: 'shared-room-seed',
	parameters: {
		particleCount: 3,
		maxSpeed: 80,
		particleLifetimeSeconds: 15,
		margin: 20,
		connectionRadius: 250,
		background: '#050508',
	},
	simulationWidth: 640,
	simulationHeight: 480,
	fixedStepSeconds: 1 / 120,
} as const

test('Flying Lines collaboration configuration has deterministic versioned binary identity', () => {
	const bytes = encodeFlyingLinesCollaborationConfigurationV1(configuration)
	assert.deepEqual(decodeFlyingLinesCollaborationConfigurationV1(bytes), configuration)
	assert.deepEqual(bytes, encodeFlyingLinesCollaborationConfigurationV1({
		...configuration,
		parameters: { ...configuration.parameters },
	}))
	assert.throws(() => decodeFlyingLinesCollaborationConfigurationV1(new Uint8Array([1, 2, 3])), /truncated/)
})
