import assert from 'node:assert/strict'
import test from 'node:test'

import type { AuthoritativeSubmitResult } from '../../../src-v2/collaboration/index.ts'
import { ConnectivityCollaborativeGame } from './collaborative-mathematical-game.ts'

const accepted = (sequence: number, duplicate = false): AuthoritativeSubmitResult<unknown> => ({
	ok: true,
	duplicate,
	event: {
		protocolVersion: 1,
		roomId: 'room',
		experimentId: 'flying-lines',
		stateVersion: 1,
		participantId: 'alice',
		clientEventId: `event-${sequence}`,
		sequence,
		stepIndex: 1,
		input: {},
	},
})

test('collaborative connectivity game counts only newly accepted authoritative edits', async () => {
	let components = 3
	let nextResult = accepted(1)
	const game = new ConnectivityCollaborativeGame({
		currentStepIndex: 4,
		session: { render: () => ({ points: 10, edges: 9, components, step: 4, frameMs: 1, droppedSteps: 0, searchBackend: 'brute' }) },
		submit: async () => nextResult,
	})
	await game.submit({ type: 'move' })
	nextResult = accepted(1, true)
	await game.submit({ type: 'move' })
	assert.equal(game.status().acceptedEdits, 1)
	components = 1
	assert.equal(game.status().complete, true)
})

test('collaborative connectivity game enforces its accepted edit budget', async () => {
	let sequence = 0
	const game = new ConnectivityCollaborativeGame({
		currentStepIndex: 0,
		session: { render: () => ({ points: 10, edges: 0, components: 10, step: 0, frameMs: 1, droppedSteps: 0, searchBackend: 'brute' }) },
		submit: async () => accepted(++sequence),
	})
	for (let index = 0; index < 5; index++) await game.submit({ index })
	assert.equal(game.status().exhausted, true)
	await assert.rejects(game.submit({ index: 6 }), /edit budget/)
})
