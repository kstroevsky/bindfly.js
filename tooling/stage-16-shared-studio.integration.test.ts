import assert from 'node:assert/strict'
import test from 'node:test'

import { WebSocket as NodeWebSocket } from 'ws'

import { AuthoritativeRoomWebSocketServer } from '../apps/collaboration-server/src/index.ts'
import { flyingLinesPlugin } from '../apps/studio/src/flying-lines-plugin.ts'
import { connectSharedExperiment } from '../apps/studio/src/shared-experiment-client.ts'
import type { ErasedExperimentSession, StudioExperimentPlugin } from '../apps/studio/src/studio-experiment-plugin.ts'
import { InMemoryAuthoritativeRoom } from '../src-v2/collaboration/index.ts'
import type { CollaborationStateAdapter } from '../src-v2/collaboration/index.ts'
import { createViewport } from '../src-v2/core/index.ts'

class FakeCanvasContext {
	fillStyle = ''
	strokeStyle = ''
	lineWidth = 0
	globalAlpha = 1
	setTransform(): void {}
	fillRect(): void {}
	beginPath(): void {}
	moveTo(): void {}
	lineTo(): void {}
	stroke(): void {}
	arc(): void {}
	fill(): void {}
}

class FakeOffscreenCanvas {
	width = 0
	height = 0
	readonly context = new FakeCanvasContext()
	getContext(): OffscreenCanvasRenderingContext2D {
		return this.context as unknown as OffscreenCanvasRenderingContext2D
	}
}

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
	if (left.byteLength !== right.byteLength) return false
	for (let index = 0; index < left.byteLength; index++) {
		if (left[index] !== right[index]) return false
	}
	return true
}

const waitUntil = async (predicate: () => boolean, label: string): Promise<void> => {
	const deadline = Date.now() + 2_000
	while (!predicate()) {
		if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}.`)
		await new Promise<void>((resolve) => setTimeout(resolve, 5))
	}
}

const createStudioSession = (
	plugin: StudioExperimentPlugin,
	parameters: unknown,
	seed: string,
	simulationWidth: number,
	simulationHeight: number,
): ErasedExperimentSession => plugin.createSession({
	canvas: new FakeOffscreenCanvas() as unknown as OffscreenCanvas,
	rendererId: 'canvas2d',
	parameters,
	formulaView: 'morph',
	seed,
	viewport: createViewport({
		cssWidth: simulationWidth,
		cssHeight: simulationHeight,
		devicePixelRatio: 1,
	}),
})

test('SharedExperimentClient bootstraps real Flying Lines Studio sessions and recovers divergence and reconnects', async (t) => {
	const collaboration = flyingLinesPlugin.collaboration
	assert.ok(collaboration)
	const parametersResult = flyingLinesPlugin.normalizeParameters({
		...flyingLinesPlugin.defaultParameters,
		particleCount: 3,
	})
	assert.equal(parametersResult.ok, true)
	if (!parametersResult.ok || !collaboration) return
	const configuration = {
		parameters: parametersResult.value,
		seed: 'stage-16-studio-shared-room',
		simulationWidth: 640,
		simulationHeight: 480,
		fixedStepSeconds: flyingLinesPlugin.timing.fixedStepSeconds,
	} as const
	const configurationBytes = collaboration.encodeConfiguration(configuration)
	const authoritySession = createStudioSession(
		flyingLinesPlugin,
		configuration.parameters,
		configuration.seed,
		configuration.simulationWidth,
		configuration.simulationHeight,
	)
	t.after(() => authoritySession.dispose())
	assert.ok(authoritySession.collaboration)
	if (!authoritySession.collaboration) return
	const adapter: CollaborationStateAdapter<unknown> = {
		parseInput: (value) => flyingLinesPlugin.parseInput(value),
		encodeInput: (input) => collaboration.encodeInput(input),
		decodeInput: (bytes) => collaboration.decodeInput(bytes),
		applyInput: (input) => authoritySession.applyInput(input),
		captureConfigurationBytes: () => configurationBytes.slice(),
		captureStateBytes: () => authoritySession.collaboration!.captureStateBytes(),
		restoreStateBytes: (bytes) => authoritySession.collaboration!.restoreStateBytes(bytes),
	}
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'studio-shared-flying-lines',
		experimentId: flyingLinesPlugin.id,
		stateVersion: flyingLinesPlugin.stateVersion,
		configurationVersion: collaboration.configurationVersion,
		adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
		maxReplaySteps: 120,
	})
	const server = new AuthoritativeRoomWebSocketServer({
		room,
		syncPointIntervalSteps: 1,
		checkpointIntervalSteps: 120,
		authenticate: (request) => {
			const participantId = new URL(request.url ?? '/', 'http://localhost').searchParams.get('participant')
			return participantId
				? { ok: true, value: { participantId } }
				: { ok: false, error: 'Missing test participant identity.' }
		},
	})
	const address = await server.start()
	t.after(async () => server.stop())

	const createClient = (participantId: string) => connectSharedExperiment({
		url: `${address.url}?participant=${participantId}`,
		roomId: 'studio-shared-flying-lines',
		participantId,
		resolvePlugin: (experimentId) => experimentId === flyingLinesPlugin.id ? flyingLinesPlugin : undefined,
		createSession: ({ plugin, configuration: roomConfiguration }) => createStudioSession(
			plugin,
			roomConfiguration.parameters,
			roomConfiguration.seed,
			roomConfiguration.simulationWidth,
			roomConfiguration.simulationHeight,
		),
		socketFactory: (url) => new NodeWebSocket(url) as unknown as WebSocket,
	})
	const alice = await createClient('alice')
	const bob = await createClient('bob')
	t.after(async () => alice.dispose())
	t.after(async () => bob.dispose())
	assert.equal(alice.descriptor.experimentId, 'flying-lines')
	assert.equal(alice.descriptor.configurationVersion, collaboration.configurationVersion)
	assert.ok(bytesEqual(alice.descriptor.configurationBytes, configurationBytes))

	const advanceAuthority = async (boundary: number): Promise<void> => {
		const stepIndex = boundary - 1
		const dtSeconds = flyingLinesPlugin.timing.fixedStepSeconds
		authoritySession.step({ index: stepIndex, dtSeconds, elapsedSeconds: boundary * dtSeconds })
		await server.advanceStepIndex(boundary)
	}
	const waitForClientsAt = async (stepIndex: number): Promise<void> => {
		await waitUntil(
			() => alice.currentStepIndex === stepIndex && bob.currentStepIndex === stepIndex,
			`shared clients at step ${stepIndex}`,
		)
		await alice.waitForIdle()
		await bob.waitForIdle()
	}
	const authorityBytes = () => authoritySession.collaboration!.captureStateBytes()
	const aliceBytes = () => alice.session.collaboration!.captureStateBytes()
	const bobBytes = () => bob.session.collaboration!.captureStateBytes()

	const added = await alice.submit({ type: 'add-point', x: 120, y: 160 })
	assert.equal(added.ok, true)
	await advanceAuthority(1)
	await waitForClientsAt(1)
	assert.ok(bytesEqual(aliceBytes(), authorityBytes()))
	assert.ok(bytesEqual(bobBytes(), authorityBytes()))

	const moved = await bob.submit({ type: 'move-point', id: 0, x: 280, y: 210 })
	assert.equal(moved.ok, true)
	await advanceAuthority(2)
	await waitForClientsAt(2)
	assert.ok(bytesEqual(aliceBytes(), authorityBytes()))
	assert.ok(bytesEqual(bobBytes(), authorityBytes()))

	alice.session.applyInput({ type: 'add-point', x: 400, y: 300 })
	assert.equal(bytesEqual(aliceBytes(), authorityBytes()), false)
	await advanceAuthority(3)
	await waitForClientsAt(3)
	await waitUntil(() => bytesEqual(aliceBytes(), authorityBytes()), 'automatic Alice snapshot resynchronization')
	assert.equal(alice.requiresResynchronization, false)
	assert.ok(bytesEqual(bobBytes(), authorityBytes()))

	await bob.disconnect()
	const whileBobAway = await alice.submit({ type: 'move-point', id: 1, x: 340, y: 250 })
	assert.equal(whileBobAway.ok, true)
	await advanceAuthority(4)
	await waitUntil(() => alice.currentStepIndex === 4, 'Alice at step 4')
	await alice.waitForIdle()
	assert.equal(bob.currentStepIndex, 3)
	await bob.reconnect()
	await waitUntil(() => bob.currentStepIndex === 4, 'Bob replay catch-up after reconnect')
	await bob.waitForIdle()
	assert.ok(bytesEqual(aliceBytes(), authorityBytes()))
	assert.ok(bytesEqual(bobBytes(), authorityBytes()))

	const sequenceBeforeAmbiguousAck = room.logHeadSequence
	const serverSessions = (server as unknown as {
		readonly sessions: Set<{ readonly socket: NodeWebSocket; readonly participantId: string }>
	}).sessions
	const aliceServerSocket = [...serverSessions].find((session) => session.participantId === 'alice')?.socket
	assert.ok(aliceServerSocket)
	if (!aliceServerSocket) return
	const originalSend = aliceServerSocket.send.bind(aliceServerSocket) as (...args: unknown[]) => unknown
	let dropSubmitResult = true
	aliceServerSocket.send = ((...args: unknown[]) => {
		const payload = args[0]
		if (dropSubmitResult && typeof payload === 'string' && payload.includes('"type":"submit-result"')) {
			dropSubmitResult = false
			aliceServerSocket.terminate()
			return undefined
		}
		return Reflect.apply(originalSend, aliceServerSocket, args)
	}) as typeof aliceServerSocket.send

	const ambiguousSubmit = alice.submit({ type: 'add-point', x: 420, y: 310 })
	await waitUntil(
		() => room.logHeadSequence === sequenceBeforeAmbiguousAck + 1 && !alice.connected,
		'ambiguous acknowledged submission to commit before transport loss',
	)
	await alice.reconnect()
	const recoveredSubmit = await ambiguousSubmit
	assert.equal(recoveredSubmit.ok && recoveredSubmit.duplicate, true)
	assert.equal(room.logHeadSequence, sequenceBeforeAmbiguousAck + 1)

	await alice.disconnect()
	const reloadedAlice = await createClient('alice')
	t.after(async () => reloadedAlice.dispose())
	const afterReload = await reloadedAlice.submit({ type: 'add-point', x: 430, y: 320 })
	assert.equal(afterReload.ok, true)
	if (recoveredSubmit.ok && afterReload.ok) {
		assert.notEqual(afterReload.event.clientEventId, recoveredSubmit.event.clientEventId)
		assert.equal(afterReload.event.sequence, recoveredSubmit.event.sequence + 1)
	}
})

test('32-client shared Studio reconnect fixture converges after churn and forced divergence', async (t) => {
	const collaboration = flyingLinesPlugin.collaboration
	assert.ok(collaboration)
	const parametersResult = flyingLinesPlugin.normalizeParameters({
		...flyingLinesPlugin.defaultParameters,
		particleCount: 1,
	})
	assert.equal(parametersResult.ok, true)
	if (!parametersResult.ok || !collaboration) return
	const configuration = {
		parameters: parametersResult.value,
		seed: 'stage-16-32-client-soak',
		simulationWidth: 320,
		simulationHeight: 240,
		fixedStepSeconds: flyingLinesPlugin.timing.fixedStepSeconds,
	} as const
	const configurationBytes = collaboration.encodeConfiguration(configuration)
	const authoritySession = createStudioSession(
		flyingLinesPlugin,
		configuration.parameters,
		configuration.seed,
		configuration.simulationWidth,
		configuration.simulationHeight,
	)
	t.after(() => authoritySession.dispose())
	assert.ok(authoritySession.collaboration)
	if (!authoritySession.collaboration) return
	const adapter: CollaborationStateAdapter<unknown> = {
		parseInput: (value) => flyingLinesPlugin.parseInput(value),
		encodeInput: (input) => collaboration.encodeInput(input),
		decodeInput: (bytes) => collaboration.decodeInput(bytes),
		applyInput: (input) => authoritySession.applyInput(input),
		captureConfigurationBytes: () => configurationBytes.slice(),
		captureStateBytes: () => authoritySession.collaboration!.captureStateBytes(),
		restoreStateBytes: (bytes) => authoritySession.collaboration!.restoreStateBytes(bytes),
	}
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'studio-shared-soak',
		experimentId: flyingLinesPlugin.id,
		stateVersion: flyingLinesPlugin.stateVersion,
		configurationVersion: collaboration.configurationVersion,
		adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
		maxReplaySteps: 32,
	})
	const server = new AuthoritativeRoomWebSocketServer({
		room,
		maxConnections: 40,
		syncPointIntervalSteps: 1,
		checkpointIntervalSteps: 120,
		authenticate: (request) => {
			const participantId = new URL(request.url ?? '/', 'http://localhost').searchParams.get('participant')
			return participantId
				? { ok: true, value: { participantId } }
				: { ok: false, error: 'Missing test participant identity.' }
		},
	})
	const address = await server.start()
	t.after(async () => server.stop())
	const clients = await Promise.all(Array.from({ length: 32 }, async (_, index) => connectSharedExperiment({
		url: `${address.url}?participant=client-${index}`,
		roomId: 'studio-shared-soak',
		participantId: `client-${index}`,
		resolvePlugin: (experimentId) => experimentId === flyingLinesPlugin.id ? flyingLinesPlugin : undefined,
		createSession: ({ plugin, configuration: roomConfiguration }) => createStudioSession(
			plugin,
			roomConfiguration.parameters,
			roomConfiguration.seed,
			roomConfiguration.simulationWidth,
			roomConfiguration.simulationHeight,
		),
		socketFactory: (url) => new NodeWebSocket(url) as unknown as WebSocket,
	})))
	t.after(async () => Promise.all(clients.map((client) => client.dispose())).then(() => undefined))
	assert.equal(server.activeConnectionCount, 32)

	let acknowledgedEvents = 0
	for (let boundary = 1; boundary <= 6; boundary++) {
		const disconnected = boundary % 2 === 0
			? clients.filter((_, index) => index % 4 === boundary % 4)
			: []
		await Promise.all(disconnected.map((client) => client.disconnect()))
		for (let offset = 0; offset < 4; offset++) {
			const candidates = clients.filter((client) => client.connected)
			const submitter = candidates[(boundary * 5 + offset) % candidates.length]!
			const result = await submitter.submit({
				type: 'add-point',
				x: 40 + boundary * 20 + offset,
				y: 50 + offset * 10,
			})
			assert.equal(result.ok, true)
			if (result.ok) acknowledgedEvents++
		}
		if (boundary === 3) {
			for (const client of clients.filter((_, index) => index % 8 === 0)) {
				client.session.applyInput({ type: 'add-point', x: 300, y: 200 })
			}
		}
		const stepIndex = boundary - 1
		const dtSeconds = flyingLinesPlugin.timing.fixedStepSeconds
		authoritySession.step({ index: stepIndex, dtSeconds, elapsedSeconds: boundary * dtSeconds })
		await server.advanceStepIndex(boundary)
		const connected = clients.filter((client) => client.connected)
		await waitUntil(
			() => connected.every((client) => client.currentStepIndex === boundary),
			`connected soak clients at step ${boundary}`,
		)
		await Promise.all(connected.map((client) => client.waitForIdle()))
		await Promise.all(disconnected.map((client) => client.reconnect()))
		await waitUntil(
			() => clients.every((client) => client.currentStepIndex === boundary),
			`reconnected soak clients at step ${boundary}`,
		)
		await Promise.all(clients.map((client) => client.waitForIdle()))
	}

	const authorityBytes = authoritySession.collaboration.captureStateBytes()
	for (const client of clients) {
		assert.ok(client.session.collaboration)
		assert.ok(bytesEqual(client.session.collaboration!.captureStateBytes(), authorityBytes))
		assert.equal(client.requiresResynchronization, false)
	}
	assert.equal(room.logHeadSequence, acknowledgedEvents)
	assert.deepEqual(room.eventLog.map((event) => event.sequence), Array.from({ length: acknowledgedEvents }, (_, index) => index + 1))
	await Promise.all(clients.map((client) => client.disconnect()))
	await waitUntil(() => server.activeConnectionCount === 0, 'all soak sessions to close')
})
