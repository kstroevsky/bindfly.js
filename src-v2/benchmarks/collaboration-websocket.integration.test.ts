import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { WebSocket } from 'ws'
import type { RawData } from 'ws'

import {
	AuthoritativeRoomWebSocketServer,
	FileAuthoritativeRoomStateStore,
	loadOrCreateAuthoritativeRoom,
} from '../../apps/collaboration-server/src/index.ts'
import type { AuthoritativeRoomStateStore } from '../../apps/collaboration-server/src/index.ts'
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
	decodeMovingPointInputV1,
	encodeFlyingLinesCollaborationConfigurationV1,
	encodeMovingPointCheckpointV1,
	encodeMovingPointInputV1,
	parseMovingPointInput,
} from '../effects/index.ts'
import { createMovingPointSimulation } from '../effects/moving-points/simulation.ts'

type MovingPointInput = ReturnType<typeof parseMovingPointInput>
type ServerMessage = CollaborationServerWireMessage<MovingPointInput>

const configuration = {
	seed: 'shared-websocket-seed',
	simulationWidth: 640,
	simulationHeight: 480,
	fixedStepSeconds: 1 / 120,
	parameters: {
	particleCount: 3,
	maxSpeed: 80,
	particleLifetimeSeconds: 15,
	margin: 20,
		connectionRadius: 250,
		background: '#050508',
	},
} as const
const viewport = createViewport({
	cssWidth: configuration.simulationWidth,
	cssHeight: configuration.simulationHeight,
	devicePixelRatio: 1,
})
const configurationBytes = encodeFlyingLinesCollaborationConfigurationV1(configuration)

const createHarness = () => {
	const simulation = createMovingPointSimulation({
		environment: { random: createSeededRandom(configuration.seed), viewport },
		parameters: configuration.parameters,
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
			decodeInput: (bytes: Uint8Array) => {
				try { return { ok: true as const, value: decodeMovingPointInputV1(bytes) } } catch (error) {
					return { ok: false as const, error: error instanceof Error ? error.message : 'Invalid moving-point input bytes.' }
				}
			},
			applyInput: (input: MovingPointInput) => simulation.applyInput(input),
			captureConfigurationBytes: () => configurationBytes.slice(),
			captureStateBytes: () => encodeMovingPointCheckpointV1(simulation.captureCheckpoint()),
			restoreStateBytes: (bytes: Uint8Array) => simulation.restoreCheckpoint(decodeMovingPointCheckpointV1(bytes)),
		},
	}
}

const stepSimulation = (simulation: ReturnType<typeof createMovingPointSimulation>, stepIndex: number): void => {
	simulation.step({
		index: stepIndex,
		dtSeconds: configuration.fixedStepSeconds,
		elapsedSeconds: (stepIndex + 1) * configuration.fixedStepSeconds,
	})
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

const rejectedUpgradeStatus = async (
	url: string,
	participantId?: string,
): Promise<number> => new Promise<number>((resolve, reject) => {
	const socket = new WebSocket(url, participantId
		? { headers: { 'x-bindfly-participant-id': participantId } }
		: undefined)
	socket.once('unexpected-response', (_request, response) => {
		response.resume()
		resolve(response.statusCode ?? 0)
	})
	socket.once('open', () => reject(new Error('Rejected collaboration WebSocket unexpectedly opened.')))
	socket.once('error', () => undefined)
})

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
	const unauthorizedStatus = await rejectedUpgradeStatus(address.url)
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

test('persistent WebSocket room recovers its checkpoint and pending event log after process restart', async (t) => {
	const directory = await mkdtemp(join(tmpdir(), 'bindfly-collaboration-'))
	t.after(async () => rm(directory, { recursive: true, force: true }))
	const stateStore = new FileAuthoritativeRoomStateStore(join(directory, 'shared-room.json'))
	const firstAuthority = createHarness()
	const firstRoom = await loadOrCreateAuthoritativeRoom({
		roomId: 'shared-flying-lines',
		experimentId: 'flying-lines',
		stateVersion: 1,
		adapter: firstAuthority.adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
	}, stateStore)
	const firstServer = new AuthoritativeRoomWebSocketServer({
		room: firstRoom,
		stateStore,
		authenticate: (request) => {
			const participantId = request.headers['x-bindfly-participant-id']
			return typeof participantId === 'string' && participantId.length > 0
				? { ok: true, value: { participantId } }
				: { ok: false, error: 'Missing participant identity.' }
		},
	})
	const firstAddress = await firstServer.start()
	const firstSocket = await openSocket(firstAddress.url, 'alice')
	const firstInbox = createInbox(firstSocket)
	assert.equal((await sendResume(firstSocket, firstInbox, 0, 0)).ok, true)
	const firstSubmit = await sendProposal(
		firstSocket,
		firstInbox,
		'alice',
		'persisted-add',
		0,
		{ type: 'add-point', x: 120, y: 160 },
	)
	assert.equal(firstSubmit.type, 'submit-result')
	stepSimulation(firstAuthority.simulation, 0)
	await firstServer.advanceStepIndex(1)
	assert.equal((await firstInbox.next()).type, 'authoritative-tick')
	const pendingSubmit = await sendProposal(
		firstSocket,
		firstInbox,
		'alice',
		'persisted-move',
		1,
		{ type: 'move-point', id: 0, x: 310, y: 220 },
	)
	assert.equal(pendingSubmit.type, 'submit-result')
	const checkpointBeforeRestart = firstAuthority.simulation.captureCheckpoint()
	await closeSocket(firstSocket)
	await firstServer.stop()

	stepSimulation(firstAuthority.simulation, 1)
	firstRoom.advanceStepIndex(2)
	const expectedAfterPendingEvent = firstAuthority.simulation.captureCheckpoint()

	const recoveredAuthority = createHarness()
	const recoveredRoom = await loadOrCreateAuthoritativeRoom({
		roomId: 'shared-flying-lines',
		experimentId: 'flying-lines',
		stateVersion: 1,
		adapter: recoveredAuthority.adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
	}, stateStore)
	assert.equal(recoveredRoom.currentStepIndex, 1)
	assert.equal(recoveredRoom.appliedSequence, 1)
	assert.equal(recoveredRoom.logHeadSequence, 2)
	assert.deepEqual(recoveredAuthority.simulation.captureCheckpoint(), checkpointBeforeRestart)

	const recoveredServer = new AuthoritativeRoomWebSocketServer({
		room: recoveredRoom,
		stateStore,
		authenticate: (request) => {
			const participantId = request.headers['x-bindfly-participant-id']
			return typeof participantId === 'string' && participantId.length > 0
				? { ok: true, value: { participantId } }
				: { ok: false, error: 'Missing participant identity.' }
		},
	})
	const recoveredAddress = await recoveredServer.start()
	const recoveredSocket = await openSocket(recoveredAddress.url, 'alice')
	const recoveredInbox = createInbox(recoveredSocket)
	const resume = await sendResume(recoveredSocket, recoveredInbox, 1, 1)
	assert.equal(resume.ok && resume.mode, 'replay')
	if (!resume.ok || resume.mode !== 'replay') return
	assert.equal(resume.events.length, 1)
	assert.equal(resume.events[0]?.sequence, 2)
	stepSimulation(recoveredAuthority.simulation, 1)
	await recoveredServer.advanceStepIndex(2)
	assert.equal((await recoveredInbox.next()).type, 'authoritative-tick')
	assert.deepEqual(recoveredAuthority.simulation.captureCheckpoint(), expectedAfterPendingEvent)
	await closeSocket(recoveredSocket)
	await recoveredServer.stop()

	const stored = await stateStore.load()
	assert.equal(stored?.snapshot.stepIndex, 2)
	assert.equal(stored?.snapshot.lastAppliedSequence, 2)
	await stateStore.delete()
	assert.equal(await stateStore.load(), undefined)
})

test('WebSocket room fails closed after durable persistence becomes unavailable', async (t) => {
	let saveCount = 0
	const stateStore: AuthoritativeRoomStateStore = {
		load: async () => undefined,
		save: async () => {
			saveCount++
			if (saveCount > 1) throw new Error('fixture storage failure')
		},
		delete: async () => undefined,
	}
	const authority = createHarness()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'shared-flying-lines',
		experimentId: 'flying-lines',
		stateVersion: 1,
		adapter: authority.adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
	})
	const server = new AuthoritativeRoomWebSocketServer({
		room,
		stateStore,
		authenticate: (request) => {
			const participantId = request.headers['x-bindfly-participant-id']
			return typeof participantId === 'string' && participantId.length > 0
				? { ok: true, value: { participantId } }
				: { ok: false, error: 'Missing participant identity.' }
		},
	})
	t.after(async () => server.stop())
	const address = await server.start()
	const socket = await openSocket(address.url, 'alice')
	t.after(async () => closeSocket(socket))
	const inbox = createInbox(socket)
	assert.equal((await sendResume(socket, inbox, 0, 0)).ok, true)
	const failed = await sendProposal(
		socket,
		inbox,
		'alice',
		'not-durable',
		0,
		{ type: 'add-point', x: 120, y: 160 },
	)
	assert.equal(failed.type, 'error')
	if (failed.type === 'error') assert.equal(failed.code, 'SERVER_ERROR')
	assert.equal(room.logHeadSequence, 1)

	const blocked = await sendProposal(
		socket,
		inbox,
		'alice',
		'blocked-after-failure',
		1,
		{ type: 'add-point', x: 200, y: 200 },
	)
	assert.equal(blocked.type, 'error')
	if (blocked.type === 'error') assert.equal(blocked.code, 'SERVER_ERROR')
	assert.equal(room.logHeadSequence, 1)
	await assert.rejects(server.advanceStepIndex(1), /fixture storage failure/)
	assert.equal(room.currentStepIndex, 0)
})

test('WebSocket transport bounds authenticated identities and concurrent connections', async (t) => {
	const authority = createHarness()
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'shared-flying-lines',
		experimentId: 'flying-lines',
		stateVersion: 1,
		adapter: authority.adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
	})
	const server = new AuthoritativeRoomWebSocketServer({
		room,
		maxConnections: 2,
		maxConnectionsPerParticipant: 1,
		authenticate: (request) => {
			const participantId = request.headers['x-bindfly-participant-id']
			return typeof participantId === 'string' && participantId.length > 0
				? { ok: true, value: { participantId } }
				: { ok: false, error: 'Missing participant identity.' }
		},
	})
	t.after(async () => server.stop())
	const address = await server.start()
	assert.equal(await rejectedUpgradeStatus(address.url, 'x'.repeat(129)), 401)

	const alice = await openSocket(address.url, 'alice')
	t.after(async () => closeSocket(alice))
	assert.equal(await rejectedUpgradeStatus(address.url, 'alice'), 429)
	const bob = await openSocket(address.url, 'bob')
	t.after(async () => closeSocket(bob))
	assert.equal(await rejectedUpgradeStatus(address.url, 'charlie'), 503)
})
