import assert from 'node:assert/strict'
import test from 'node:test'

import { WebSocket } from 'ws'
import type { RawData } from 'ws'

import { AuthoritativeRoomWebSocketServer } from '../../apps/collaboration-server/src/index.ts'
import {
	COLLABORATION_PROTOCOL_VERSION,
	COLLABORATION_WIRE_VERSION,
	CollaborationReplica,
	InMemoryAuthoritativeRoom,
	encodeClientCollaborationWireMessage,
	parseServerCollaborationWireMessage,
} from '../collaboration/index.ts'
import type { CollaborationResumePlan, CollaborationServerWireMessage } from '../collaboration/index.ts'
import { createSeededRandom, createViewport } from '../core/index.ts'
import {
	decodeMovingPointCheckpointV1,
	encodeMovingPointCheckpointV1,
	encodeMovingPointInputV1,
	parseMovingPointInput,
} from '../effects/index.ts'
import { createMovingPointSimulation } from '../effects/moving-points/simulation.ts'

type MovingPointInput = ReturnType<typeof parseMovingPointInput>
type ServerMessage = CollaborationServerWireMessage<MovingPointInput>

const parameters = {
	particleCount: 3,
	maxSpeed: 80,
	particleLifetimeSeconds: 15,
	margin: 20,
}
const viewport = createViewport({ cssWidth: 640, cssHeight: 480, devicePixelRatio: 1 })
const configurationBytes = new TextEncoder().encode('flying-lines-websocket-fixture-v1')

const createHarness = () => {
	const simulation = createMovingPointSimulation({
		environment: { random: createSeededRandom('shared-websocket-seed'), viewport },
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
			applyInput: (input: MovingPointInput) => simulation.applyInput(input),
			captureConfigurationBytes: () => configurationBytes.slice(),
			captureStateBytes: () => encodeMovingPointCheckpointV1(simulation.captureCheckpoint()),
			restoreStateBytes: (bytes: Uint8Array) => simulation.restoreCheckpoint(decodeMovingPointCheckpointV1(bytes)),
		},
	}
}

const stepSimulation = (simulation: ReturnType<typeof createMovingPointSimulation>, stepIndex: number): void => {
	simulation.step({ index: stepIndex, dtSeconds: 1 / 120, elapsedSeconds: (stepIndex + 1) / 120 })
}

const openSocket = async (url: string, participantId: string): Promise<WebSocket> => {
	const socket = new WebSocket(url, { headers: { 'x-bindfly-participant-id': participantId } })
	await new Promise<void>((resolve, reject) => {
		socket.once('open', resolve)
		socket.once('error', reject)
	})
	return socket
}

const closeSocket = async (socket: WebSocket): Promise<void> => {
	if (socket.readyState === WebSocket.CLOSED) return
	await new Promise<void>((resolve) => {
		socket.once('close', () => resolve())
		socket.close()
	})
}

const rawDataToUtf8 = (raw: RawData): string => {
	if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8')
	if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8')
	return raw.toString('utf8')
}

const createInbox = (socket: WebSocket) => {
	const queue: string[] = []
	const waiters: Array<(text: string) => void> = []
	socket.on('message', (raw, isBinary) => {
		assert.equal(isBinary, false)
		const text = rawDataToUtf8(raw)
		const waiter = waiters.shift()
		if (waiter) waiter(text)
		else queue.push(text)
	})
	return {
		next: async (): Promise<ServerMessage> => {
			const text = queue.shift() ?? await new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error('Timed out waiting for collaboration WebSocket message.')), 2_000)
				waiters.push((message) => {
					clearTimeout(timeout)
					resolve(message)
				})
			})
			const parsed = parseServerCollaborationWireMessage<MovingPointInput>(text)
			if (!parsed.ok) assert.fail(parsed.error)
			return parsed.value
		},
	}
}

const sendResume = async (
	socket: WebSocket,
	inbox: ReturnType<typeof createInbox>,
	lastAppliedSequence: number,
	stepIndex: number,
): Promise<CollaborationResumePlan<MovingPointInput>> => {
	socket.send(encodeClientCollaborationWireMessage({
		wireVersion: COLLABORATION_WIRE_VERSION,
		type: 'resume',
		request: {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: 'shared-flying-lines',
			experimentId: 'flying-lines',
			stateVersion: 1,
			lastAppliedSequence,
			stepIndex,
		},
	}))
	const message = await inbox.next()
	if (message.type !== 'resume-plan') assert.fail(`Expected resume-plan, received ${message.type}.`)
	return message.plan
}

const sendProposal = async (
	socket: WebSocket,
	inbox: ReturnType<typeof createInbox>,
	participantId: string,
	clientEventId: string,
	knownSequence: number,
	input: MovingPointInput,
) => {
	socket.send(encodeClientCollaborationWireMessage({
		wireVersion: COLLABORATION_WIRE_VERSION,
		type: 'submit',
		proposal: {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: 'shared-flying-lines',
			participantId,
			clientEventId,
			knownSequence,
			input,
		},
	}))
	return inbox.next()
}

test('real WebSocket clients preserve authoritative ordering and reconnect through replay then snapshot', async (t) => {
	const authority = createHarness()
	const alice = createHarness()
	const bob = createHarness()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'shared-flying-lines', experimentId: 'flying-lines', stateVersion: 1, adapter: authority.adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
		maxReplayEvents: 0,
	})
	const server = new AuthoritativeRoomWebSocketServer({
		room,
		authenticate: (request) => {
			const participantId = request.headers['x-bindfly-participant-id']
			return typeof participantId === 'string' && participantId.length > 0
				? { ok: true, value: { participantId } }
				: { ok: false, error: 'Missing participant identity.' }
		},
	})
	const address = await server.start()
	t.after(async () => server.stop())

	const aliceReplica = new CollaborationReplica({
		roomId: 'shared-flying-lines', experimentId: 'flying-lines', stateVersion: 1, adapter: alice.adapter,
	})
	const bobReplica = new CollaborationReplica({
		roomId: 'shared-flying-lines', experimentId: 'flying-lines', stateVersion: 1, adapter: bob.adapter,
	})
	const unauthorizedStatus = await new Promise<number>((resolve, reject) => {
		const socket = new WebSocket(address.url)
		socket.once('unexpected-response', (_request, response) => {
			response.resume()
			resolve(response.statusCode ?? 0)
		})
		socket.once('open', () => reject(new Error('Unauthenticated collaboration WebSocket unexpectedly opened.')))
		socket.once('error', () => undefined)
	})
	assert.equal(unauthorizedStatus, 401)

	const aliceSocket = await openSocket(address.url, 'alice')
	const bobSocket = await openSocket(address.url, 'bob')
	t.after(async () => closeSocket(aliceSocket))
	const aliceInbox = createInbox(aliceSocket)
	let bobInbox = createInbox(bobSocket)
	const beforeResume = await sendProposal(
		aliceSocket,
		aliceInbox,
		'alice',
		'before-resume',
		0,
		{ type: 'add-point', x: 5, y: 5 },
	)
	assert.equal(beforeResume.type, 'error')
	if (beforeResume.type === 'error') assert.equal(beforeResume.code, 'RESUME_REQUIRED')
	assert.equal(room.logHeadSequence, 0)
	assert.equal((await sendResume(aliceSocket, aliceInbox, 0, 0)).ok, true)
	assert.equal((await sendResume(bobSocket, bobInbox, 0, 0)).ok, true)

	const spoofed = await sendProposal(
		aliceSocket,
		aliceInbox,
		'bob',
		'spoofed',
		0,
		{ type: 'add-point', x: 10, y: 10 },
	)
	assert.equal(spoofed.type, 'error')
	if (spoofed.type === 'error') assert.equal(spoofed.code, 'PARTICIPANT_MISMATCH')
	assert.equal(room.logHeadSequence, 0)

	const aliceSubmit = await sendProposal(
		aliceSocket,
		aliceInbox,
		'alice',
		'add-1',
		0,
		{ type: 'add-point', x: 120, y: 160 },
	)
	const bobEventOne = await bobInbox.next()
	assert.equal(aliceSubmit.type, 'submit-result')
	assert.equal(bobEventOne.type, 'authoritative-event')
	if (aliceSubmit.type !== 'submit-result' || !aliceSubmit.result.ok || bobEventOne.type !== 'authoritative-event') return
	assert.equal(aliceReplica.receive(aliceSubmit.result.event).status, 'buffered-step')
	assert.equal(bobReplica.receive(bobEventOne.event).status, 'buffered-step')

	const bobSubmit = await sendProposal(
		bobSocket,
		bobInbox,
		'bob',
		'move-1',
		0,
		{ type: 'move-point', id: 0, x: 250, y: 210 },
	)
	const aliceEventTwo = await aliceInbox.next()
	assert.equal(bobSubmit.type, 'submit-result')
	assert.equal(aliceEventTwo.type, 'authoritative-event')
	if (bobSubmit.type !== 'submit-result' || !bobSubmit.result.ok || aliceEventTwo.type !== 'authoritative-event') return
	assert.equal(bobReplica.receive(bobSubmit.result.event).status, 'buffered-step')
	assert.equal(aliceReplica.receive(aliceEventTwo.event).status, 'buffered-step')

	stepSimulation(authority.simulation, 0)
	stepSimulation(alice.simulation, 0)
	stepSimulation(bob.simulation, 0)
	await server.advanceStepIndex(1)
	const aliceTickOne = await aliceInbox.next()
	const bobTickOne = await bobInbox.next()
	assert.equal(aliceTickOne.type, 'authoritative-tick')
	assert.equal(bobTickOne.type, 'authoritative-tick')
	if (aliceTickOne.type !== 'authoritative-tick' || bobTickOne.type !== 'authoritative-tick') return
	assert.equal(aliceReplica.receiveTick(aliceTickOne.tick).ok, true)
	assert.equal(bobReplica.receiveTick(bobTickOne.tick).ok, true)
	assert.equal(aliceReplica.advanceStepIndex(1).ok, true)
	assert.equal(bobReplica.advanceStepIndex(1).ok, true)
	assert.deepEqual(alice.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
	assert.deepEqual(bob.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())

	await closeSocket(bobSocket)
	const pendingSubmit = await sendProposal(
		aliceSocket,
		aliceInbox,
		'alice',
		'move-before-reconnect',
		2,
		{ type: 'move-point', id: 1, x: 300, y: 230 },
	)
	assert.equal(pendingSubmit.type, 'submit-result')
	if (pendingSubmit.type !== 'submit-result' || !pendingSubmit.result.ok) return
	assert.equal(aliceReplica.receive(pendingSubmit.result.event).status, 'buffered-step')

	const replaySocket = await openSocket(address.url, 'bob')
	bobInbox = createInbox(replaySocket)
	const replay = await sendResume(replaySocket, bobInbox, bobReplica.lastAppliedSequence, bobReplica.currentStepIndex)
	assert.equal(replay.ok && replay.mode, 'replay')
	assert.equal((await bobReplica.applyResumePlan(replay)).ok, true)
	await closeSocket(replaySocket)

	stepSimulation(authority.simulation, 1)
	stepSimulation(alice.simulation, 1)
	await server.advanceStepIndex(2)
	const aliceTickTwo = await aliceInbox.next()
	assert.equal(aliceTickTwo.type, 'authoritative-tick')
	if (aliceTickTwo.type !== 'authoritative-tick') return
	assert.equal(aliceReplica.receiveTick(aliceTickTwo.tick).ok, true)
	assert.equal(aliceReplica.advanceStepIndex(2).ok, true)

	const futureSubmit = await sendProposal(
		aliceSocket,
		aliceInbox,
		'alice',
		'add-after-snapshot',
		3,
		{ type: 'add-point', x: 340, y: 280 },
	)
	assert.equal(futureSubmit.type, 'submit-result')
	if (futureSubmit.type !== 'submit-result' || !futureSubmit.result.ok) return
	assert.equal(aliceReplica.receive(futureSubmit.result.event).status, 'buffered-step')

	const snapshotSocket = await openSocket(address.url, 'bob')
	t.after(async () => closeSocket(snapshotSocket))
	bobInbox = createInbox(snapshotSocket)
	const snapshotPlan = await sendResume(
		snapshotSocket,
		bobInbox,
		bobReplica.lastAppliedSequence,
		bobReplica.currentStepIndex,
	)
	assert.equal(snapshotPlan.ok && snapshotPlan.mode, 'snapshot')
	if (!snapshotPlan.ok || snapshotPlan.mode !== 'snapshot') return
	assert.equal(snapshotPlan.snapshot.lastAppliedSequence, 3)
	assert.equal(snapshotPlan.events.length, 1)
	assert.equal(snapshotPlan.events[0]!.sequence, 4)
	assert.equal((await bobReplica.applyResumePlan(snapshotPlan)).ok, true)
	assert.deepEqual(bob.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())

	stepSimulation(authority.simulation, 2)
	stepSimulation(alice.simulation, 2)
	stepSimulation(bob.simulation, 2)
	await server.advanceStepIndex(3)
	const aliceTickThree = await aliceInbox.next()
	const bobTickThree = await bobInbox.next()
	assert.equal(aliceTickThree.type, 'authoritative-tick')
	assert.equal(bobTickThree.type, 'authoritative-tick')
	if (aliceTickThree.type !== 'authoritative-tick' || bobTickThree.type !== 'authoritative-tick') return
	assert.equal(aliceReplica.receiveTick(aliceTickThree.tick).ok, true)
	assert.equal(bobReplica.receiveTick(bobTickThree.tick).ok, true)
	assert.equal(aliceReplica.advanceStepIndex(3).ok, true)
	assert.equal(bobReplica.advanceStepIndex(3).ok, true)
	assert.deepEqual(alice.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
	assert.deepEqual(bob.simulation.captureCheckpoint(), authority.simulation.captureCheckpoint())
})
