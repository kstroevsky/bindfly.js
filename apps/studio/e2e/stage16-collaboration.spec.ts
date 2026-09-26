import { expect, test } from '@playwright/test'

import { AuthoritativeRoomWebSocketServer } from '../../collaboration-server/src/index.ts'
import { InMemoryAuthoritativeRoom } from '../../../src-v2/collaboration/index.ts'
import { createSeededRandom, createViewport } from '../../../src-v2/core/index.ts'
import {
	decodeMovingPointCheckpointV1,
	decodeMovingPointInputV1,
	encodeFlyingLinesCollaborationConfigurationV1,
	encodeMovingPointCheckpointV1,
	encodeMovingPointInputV1,
	parseMovingPointInput,
} from '../../../src-v2/effects/index.ts'
import { createMovingPointSimulation } from '../../../src-v2/effects/moving-points/simulation.ts'

const configuration = {
	seed: 'stage-16-cross-browser',
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

const stateBase64Url = (simulation: ReturnType<typeof createMovingPointSimulation>): string =>
	Buffer.from(encodeMovingPointCheckpointV1(simulation.captureCheckpoint())).toString('base64url')

const harness = (page: import('@playwright/test').Page) => ({
	connect: (options: { url: string; roomId: string; participantId: string }) => page.evaluate(async (value) => {
		const api = (window as unknown as { __bindflyStage16Collaboration: { connect(input: typeof value): Promise<void> } }).__bindflyStage16Collaboration
		await api.connect(value)
	}, options),
	submit: (input: unknown) => page.evaluate(async (value) => {
		const api = (window as unknown as { __bindflyStage16Collaboration: { submit(input: unknown): Promise<unknown> } }).__bindflyStage16Collaboration
		return api.submit(value)
	}, input),
	diverge: (input: unknown) => page.evaluate((value) => {
		const api = (window as unknown as { __bindflyStage16Collaboration: { diverge(input: unknown): void } }).__bindflyStage16Collaboration
		api.diverge(value)
	}, input),
	disconnect: () => page.evaluate(async () => {
		const api = (window as unknown as { __bindflyStage16Collaboration: { disconnect(): Promise<void> } }).__bindflyStage16Collaboration
		await api.disconnect()
	}),
	reconnect: () => page.evaluate(async () => {
		const api = (window as unknown as { __bindflyStage16Collaboration: { reconnect(): Promise<void> } }).__bindflyStage16Collaboration
		await api.reconnect()
	}),
	status: () => page.evaluate(() => {
		const api = (window as unknown as { __bindflyStage16Collaboration: { status(): {
			connected: boolean
			currentStepIndex: number
			lastAppliedSequence: number
			requiresResynchronization: boolean
			stateBase64Url: string
		} } }).__bindflyStage16Collaboration
		return api.status()
	}),
})

test('browser replicas detect divergence and recover through authoritative snapshots and reconnect replay', async ({ browser, baseURL }) => {
	const simulation = createMovingPointSimulation({
		environment: { random: createSeededRandom(configuration.seed), viewport },
		parameters: configuration.parameters,
	})
	const adapter = {
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
		applyInput: (input: ReturnType<typeof parseMovingPointInput>) => simulation.applyInput(input),
		captureConfigurationBytes: () => configurationBytes.slice(),
		captureStateBytes: () => encodeMovingPointCheckpointV1(simulation.captureCheckpoint()),
		restoreStateBytes: (bytes: Uint8Array) => simulation.restoreCheckpoint(decodeMovingPointCheckpointV1(bytes)),
	}
	const room = new InMemoryAuthoritativeRoom({
		roomId: 'cross-browser-room',
		experimentId: 'flying-lines',
		stateVersion: 1,
		configurationVersion: 1,
		adapter,
		authorizeInput: () => ({ ok: true, value: undefined }),
	})
	const server = new AuthoritativeRoomWebSocketServer({
		room,
		syncPointIntervalSteps: 1,
		authenticate: (request) => {
			const participantId = new URL(request.url ?? '/', 'http://localhost').searchParams.get('participant')
			return participantId
				? { ok: true, value: { participantId } }
				: { ok: false, error: 'Missing browser fixture participant.' }
		},
	})
	const address = await server.start()
	const context = await browser.newContext()
	const alicePage = await context.newPage()
	const bobPage = await context.newPage()
	try {
		await Promise.all([
			alicePage.goto(`${baseURL}/?stage16CollaborationHarness=1#/lab/flying-lines`),
			bobPage.goto(`${baseURL}/?stage16CollaborationHarness=1#/lab/flying-lines`),
		])
		const alice = harness(alicePage)
		const bob = harness(bobPage)
		await Promise.all([
			alice.connect({ url: `${address.url}?participant=alice`, roomId: 'cross-browser-room', participantId: 'alice' }),
			bob.connect({ url: `${address.url}?participant=bob`, roomId: 'cross-browser-room', participantId: 'bob' }),
		])

		await alice.submit({ type: 'add-point', x: 120, y: 160 })
		simulation.step({ index: 0, dtSeconds: configuration.fixedStepSeconds, elapsedSeconds: configuration.fixedStepSeconds })
		await server.advanceStepIndex(1)
		await expect.poll(async () => (await alice.status()).currentStepIndex).toBe(1)
		await expect.poll(async () => (await bob.status()).currentStepIndex).toBe(1)
		const authoritativeStepOne = stateBase64Url(simulation)
		await expect.poll(async () => (await alice.status()).stateBase64Url).toBe(authoritativeStepOne)
		await expect.poll(async () => (await bob.status()).stateBase64Url).toBe(authoritativeStepOne)

		await alice.diverge({ type: 'add-point', x: 400, y: 300 })
		simulation.step({ index: 1, dtSeconds: configuration.fixedStepSeconds, elapsedSeconds: 2 * configuration.fixedStepSeconds })
		await server.advanceStepIndex(2)
		const authoritativeStepTwo = stateBase64Url(simulation)
		await expect.poll(async () => (await alice.status()).stateBase64Url).toBe(authoritativeStepTwo)
		await expect.poll(async () => (await alice.status()).requiresResynchronization).toBe(false)

		await bob.disconnect()
		await alice.submit({ type: 'move-point', id: 0, x: 300, y: 220 })
		simulation.step({ index: 2, dtSeconds: configuration.fixedStepSeconds, elapsedSeconds: 3 * configuration.fixedStepSeconds })
		await server.advanceStepIndex(3)
		const authoritativeStepThree = stateBase64Url(simulation)
		await expect.poll(async () => (await alice.status()).stateBase64Url).toBe(authoritativeStepThree)
		await bob.reconnect()
		await expect.poll(async () => (await bob.status()).stateBase64Url).toBe(authoritativeStepThree)
		await expect.poll(async () => (await bob.status()).currentStepIndex).toBe(3)
	} finally {
		await context.close()
		await server.stop()
		simulation.dispose()
	}
})
