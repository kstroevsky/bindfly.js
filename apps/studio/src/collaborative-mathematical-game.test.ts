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

test('collaborative connectivity game derives edits from shared authoritative history', async () => {
	let components = 3
	let lastAppliedSequence = 10
	let nextResult = accepted(11)
	const game = new ConnectivityCollaborativeGame({
		currentStepIndex: 4,
		get lastAppliedSequence() { return lastAppliedSequence },
		session: { render: () => ({ points: 10, edges: 9, components, step: 4, frameMs: 1, droppedSteps: 0, searchBackend: 'brute' }) },
		submit: async () => nextResult,
	}, 10)
	await game.submit({ type: 'move' })
	lastAppliedSequence = 11
	nextResult = accepted(11, true)
	await game.submit({ type: 'move' })
	assert.equal(game.status().acceptedEdits, 1)
	components = 1
	assert.equal(game.status().complete, true)
})

test('collaborative connectivity game enforces its accepted edit budget', async () => {
	let sequence = 20
	const game = new ConnectivityCollaborativeGame({
		currentStepIndex: 0,
		get lastAppliedSequence() { return sequence },
		session: { render: () => ({ points: 10, edges: 0, components: 10, step: 0, frameMs: 1, droppedSteps: 0, searchBackend: 'brute' }) },
		submit: async () => accepted(sequence + 1),
	}, 20)
	for (let index = 0; index < 5; index++) await game.submit({ index })
	sequence = 25
	assert.equal(game.status().exhausted, true)
	await assert.rejects(game.submit({ index: 6 }), /edit budget/)
})

test('collaborators observe the same edit count and cannot report a win after the shared budget is exceeded', () => {
	let sequence = 30
	let components = 2
	const shared = {
		currentStepIndex: 0,
		get lastAppliedSequence() { return sequence },
		session: { render: () => ({ points: 4, edges: 2, components, step: 0, frameMs: 1, droppedSteps: 0, searchBackend: 'brute' as const }) },
		submit: async () => accepted(sequence + 1),
	}
	const alice = new ConnectivityCollaborativeGame(shared, 30)
	const bob = new ConnectivityCollaborativeGame(shared, 30)

	sequence = 35
	assert.equal(alice.status().acceptedEdits, 5)
	assert.equal(bob.status().acceptedEdits, 5)

	sequence = 36
	components = 1
	assert.equal(alice.status().acceptedEdits, 6)
	assert.equal(alice.status().complete, false)
	assert.equal(alice.status().exhausted, true)
})
