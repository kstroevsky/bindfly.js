import assert from 'node:assert/strict'
import test from 'node:test'

import {
	RUNTIME_PROTOCOL_VERSION,
	createRuntimeCommand,
	isRuntimeCommand,
	runtimeCommandTypes,
} from './protocol.ts'

test('enumerates the complete runtime command surface', () => {
	assert.deepEqual(runtimeCommandTypes, [
		'initialize',
		'resize',
		'input',
		'parameters',
		'pause',
		'resume',
		'dispose',
	])
})

test('creates a versioned command envelope', () => {
	const command = createRuntimeCommand({
		requestId: 'request-1',
		type: 'pause',
		payload: undefined,
	})

	assert.deepEqual(command, {
		protocolVersion: RUNTIME_PROTOCOL_VERSION,
		requestId: 'request-1',
		type: 'pause',
		payload: undefined,
	})
	assert.equal(isRuntimeCommand(command), true)
})

test('rejects wrong versions, unknown commands and missing request identity', () => {
	assert.equal(isRuntimeCommand({
		protocolVersion: RUNTIME_PROTOCOL_VERSION + 1,
		requestId: 'request-1',
		type: 'pause',
	}), false)
	assert.equal(isRuntimeCommand({
		protocolVersion: RUNTIME_PROTOCOL_VERSION,
		requestId: 'request-1',
		type: 'unknown',
	}), false)
	assert.equal(isRuntimeCommand({
		protocolVersion: RUNTIME_PROTOCOL_VERSION,
		requestId: '',
		type: 'pause',
	}), false)
})
