import { createServer } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'

import { WebSocket, WebSocketServer } from 'ws'
import type { RawData } from 'ws'

import type { Result } from '../../../src-v2/core/index.ts'
import {
	COLLABORATION_WIRE_VERSION,
	MAX_COLLABORATION_ID_LENGTH,
	encodeServerCollaborationWireMessage,
	parseClientCollaborationWireMessage,
} from '../../../src-v2/collaboration/index.ts'
import type {
	CollaborationServerWireMessage,
	InMemoryAuthoritativeRoom,
} from '../../../src-v2/collaboration/index.ts'
import type { AuthoritativeRoomStateStore } from './authoritative-room-state-store.ts'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 0
const DEFAULT_PATH = '/collaboration'
const DEFAULT_MAX_WIRE_BYTES = 64 * 1024
const DEFAULT_MAX_CONNECTIONS = 128
const DEFAULT_MAX_CONNECTIONS_PER_PARTICIPANT = 4
const DEFAULT_MAX_BUFFERED_BYTES = 512 * 1024
const DEFAULT_SYNC_POINT_INTERVAL_STEPS = 120
const DEFAULT_CHECKPOINT_INTERVAL_STEPS = 120

export interface AuthenticatedCollaborationParticipant {
	readonly participantId: string
}

export type AuthenticateCollaborationConnection = (
	request: IncomingMessage,
) => Result<AuthenticatedCollaborationParticipant, string> | Promise<Result<AuthenticatedCollaborationParticipant, string>>

export interface AuthoritativeRoomWebSocketServerOptions<Input> {
	readonly room: InMemoryAuthoritativeRoom<Input>
	readonly authenticate: AuthenticateCollaborationConnection
	readonly stateStore?: AuthoritativeRoomStateStore
	readonly host?: string
	readonly port?: number
	readonly path?: string
	readonly maxWireBytes?: number
	readonly maxConnections?: number
	readonly maxConnectionsPerParticipant?: number
	readonly maxBufferedBytes?: number
	readonly syncPointIntervalSteps?: number
	readonly checkpointIntervalSteps?: number
}

export interface CollaborationServerAddress {
	readonly host: string
	readonly port: number
	readonly path: string
	readonly url: string
}

export interface AuthoritativeStepContext {
	readonly stepIndex: number
	readonly nextStepIndex: number
}

export type RunAuthoritativeSimulationStep = (
	context: AuthoritativeStepContext,
) => void | Promise<void>

interface ConnectionSession {
	readonly socket: WebSocket
	readonly participantId: string
	resumed: boolean
}

const writeUpgradeRejection = (socket: Duplex, status: number, reason: string): void => {
	const body = `${reason}\n`
	socket.write(
		`HTTP/1.1 ${status} ${reason}\r\n`
		+ 'Connection: close\r\n'
		+ 'Content-Type: text/plain; charset=utf-8\r\n'
		+ `Content-Length: ${Buffer.byteLength(body)}\r\n`
		+ '\r\n'
		+ body,
	)
	socket.destroy()
}

const rawDataToUtf8 = (raw: RawData): string => {
	if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf8')
	if (raw instanceof ArrayBuffer) return Buffer.from(raw).toString('utf8')
	return raw.toString('utf8')
}

export class AuthoritativeRoomWebSocketServer<Input> {
	private readonly room: InMemoryAuthoritativeRoom<Input>
	private readonly authenticate: AuthenticateCollaborationConnection
	private readonly stateStore: AuthoritativeRoomStateStore | undefined
	private readonly host: string
	private readonly port: number
	private readonly path: string
	private readonly maxConnections: number
	private readonly maxConnectionsPerParticipant: number
	private readonly maxBufferedBytes: number
	private readonly syncPointIntervalSteps: number
	private readonly checkpointIntervalSteps: number
	private readonly httpServer: Server
	private readonly webSocketServer: WebSocketServer
	private readonly sessions = new Set<ConnectionSession>()
	private operationTail: Promise<void> = Promise.resolve()
	private address: CollaborationServerAddress | undefined
	private authorityFailure: Error | undefined

	get activeConnectionCount(): number {
		return this.sessions.size
	}

	constructor(options: AuthoritativeRoomWebSocketServerOptions<Input>) {
		const maxWireBytes = options.maxWireBytes ?? DEFAULT_MAX_WIRE_BYTES
		if (!Number.isSafeInteger(maxWireBytes) || maxWireBytes <= 0) {
			throw new RangeError('Collaboration maxWireBytes must be a positive safe integer.')
		}
		const maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS
		if (!Number.isSafeInteger(maxConnections) || maxConnections <= 0) {
			throw new RangeError('Collaboration maxConnections must be a positive safe integer.')
		}
		const maxConnectionsPerParticipant = options.maxConnectionsPerParticipant
			?? DEFAULT_MAX_CONNECTIONS_PER_PARTICIPANT
		if (!Number.isSafeInteger(maxConnectionsPerParticipant) || maxConnectionsPerParticipant <= 0) {
			throw new RangeError('Collaboration maxConnectionsPerParticipant must be a positive safe integer.')
		}
		const maxBufferedBytes = options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES
		if (!Number.isSafeInteger(maxBufferedBytes) || maxBufferedBytes <= 0) {
			throw new RangeError('Collaboration maxBufferedBytes must be a positive safe integer.')
		}
		const syncPointIntervalSteps = options.syncPointIntervalSteps ?? DEFAULT_SYNC_POINT_INTERVAL_STEPS
		if (!Number.isSafeInteger(syncPointIntervalSteps) || syncPointIntervalSteps <= 0) {
			throw new RangeError('Collaboration syncPointIntervalSteps must be a positive safe integer.')
		}
		const checkpointIntervalSteps = options.checkpointIntervalSteps ?? DEFAULT_CHECKPOINT_INTERVAL_STEPS
		if (!Number.isSafeInteger(checkpointIntervalSteps) || checkpointIntervalSteps <= 0) {
			throw new RangeError('Collaboration checkpointIntervalSteps must be a positive safe integer.')
		}
		this.room = options.room
		this.authenticate = options.authenticate
		this.stateStore = options.stateStore
		this.host = options.host ?? DEFAULT_HOST
		this.port = options.port ?? DEFAULT_PORT
		this.path = options.path ?? DEFAULT_PATH
		this.maxConnections = maxConnections
		this.maxConnectionsPerParticipant = maxConnectionsPerParticipant
		this.maxBufferedBytes = maxBufferedBytes
		this.syncPointIntervalSteps = syncPointIntervalSteps
		this.checkpointIntervalSteps = checkpointIntervalSteps
		if (!this.path.startsWith('/')) throw new Error('Collaboration WebSocket path must start with /.')

		this.httpServer = createServer((_request, response) => {
			response.statusCode = 404
			response.end('Not found\n')
		})
		this.webSocketServer = new WebSocketServer({ noServer: true, maxPayload: maxWireBytes })
		this.httpServer.on('upgrade', (request, socket, head) => {
			void this.handleUpgrade(request, socket, head).catch(() => {
				if (!socket.destroyed) writeUpgradeRejection(socket, 500, 'Internal Server Error')
			})
		})
	}

	private enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
		const run = this.operationTail.then(operation, operation)
		this.operationTail = run.then(() => undefined, () => undefined)
		return run
	}

	private async handleUpgrade(
		request: IncomingMessage,
		socket: Duplex,
		head: Buffer,
	): Promise<void> {
		const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname
		if (requestPath !== this.path) {
			writeUpgradeRejection(socket, 404, 'Not Found')
			return
		}
		if (this.authorityFailure) {
			writeUpgradeRejection(socket, 503, 'Service Unavailable')
			return
		}
		const authenticated = await this.authenticate(request)
		if (!authenticated.ok
			|| authenticated.value.participantId.length === 0
			|| authenticated.value.participantId.length > MAX_COLLABORATION_ID_LENGTH) {
			writeUpgradeRejection(socket, 401, 'Unauthorized')
			return
		}
		if (this.sessions.size >= this.maxConnections) {
			writeUpgradeRejection(socket, 503, 'Service Unavailable')
			return
		}
		let participantConnections = 0
		for (const session of this.sessions) {
			if (session.participantId === authenticated.value.participantId) participantConnections++
		}
		if (participantConnections >= this.maxConnectionsPerParticipant) {
			writeUpgradeRejection(socket, 429, 'Too Many Requests')
			return
		}
		this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
			this.acceptConnection(webSocket, authenticated.value.participantId)
		})
	}

	private acceptConnection(socket: WebSocket, participantId: string): void {
		const session: ConnectionSession = { socket, participantId, resumed: false }
		this.sessions.add(session)
		socket.on('close', () => this.sessions.delete(session))
		socket.on('message', (raw, isBinary) => {
			if (isBinary) {
				this.sendError(session, 'MALFORMED_MESSAGE', 'Collaboration wire messages must use UTF-8 text frames.')
				return
			}
			const text = rawDataToUtf8(raw)
			void this.enqueue(() => this.handleMessage(session, text)).catch(() => {
				this.sendError(session, 'SERVER_ERROR', 'Collaboration server could not process the message.')
			})
		})
	}

	private sendEncoded(session: ConnectionSession, encoded: string): boolean {
		if (session.socket.readyState !== WebSocket.OPEN) return false
		const byteLength = Buffer.byteLength(encoded)
		if (session.socket.bufferedAmount + byteLength > this.maxBufferedBytes) {
			session.socket.terminate()
			return false
		}
		session.socket.send(encoded)
		return true
	}

	private send(session: ConnectionSession, message: CollaborationServerWireMessage<Input>): boolean {
		return this.sendEncoded(session, encodeServerCollaborationWireMessage(message))
	}

	private sendError(
		session: ConnectionSession,
		code: Extract<CollaborationServerWireMessage<Input>, { type: 'error' }>['code'],
		error: string,
	): void {
		this.send(session, { wireVersion: COLLABORATION_WIRE_VERSION, type: 'error', code, error })
	}

	private broadcast(message: CollaborationServerWireMessage<Input>, excluded?: WebSocket): void {
		const encoded = encodeServerCollaborationWireMessage(message)
		for (const session of this.sessions) {
			if (!session.resumed || session.socket === excluded || session.socket.readyState !== WebSocket.OPEN) continue
			this.sendEncoded(session, encoded)
		}
	}

	private poisonAuthority(error: unknown): Error {
		if (!this.authorityFailure) {
			this.authorityFailure = error instanceof Error ? error : new Error('Collaboration authority failed.')
			for (const session of this.sessions) session.socket.terminate()
		}
		return this.authorityFailure
	}

	private async appendAcceptedEvent(sequence: number): Promise<void> {
		if (!this.stateStore) return
		try {
			await this.stateStore.appendEvent(this.room.capturePersistedEvent(sequence))
		} catch (error) {
			throw this.poisonAuthority(error)
		}
	}

	private async saveCheckpoint(): Promise<void> {
		if (!this.stateStore) return
		try {
			await this.stateStore.saveCheckpoint(await this.room.capturePersistenceCheckpoint())
		} catch (error) {
			throw this.poisonAuthority(error)
		}
	}

	private async handleMessage(session: ConnectionSession, text: string): Promise<void> {
		const parsed = parseClientCollaborationWireMessage(text)
		if (!parsed.ok) {
			this.sendError(session, 'MALFORMED_MESSAGE', parsed.error)
			return
		}
		if (this.authorityFailure) {
			this.sendError(session, 'SERVER_ERROR', 'Collaboration authority is unavailable; reconnect after server recovery.')
			return
		}
		if (parsed.value.type === 'describe-room') {
			this.send(session, {
				wireVersion: COLLABORATION_WIRE_VERSION,
				type: 'room-descriptor',
				descriptor: this.room.createDescriptor(),
			})
			return
		}
		if (parsed.value.type === 'resume') {
			const plan = await this.room.createResumePlan(parsed.value.request)
			this.send(session, { wireVersion: COLLABORATION_WIRE_VERSION, type: 'resume-plan', plan })
			if (plan.ok) session.resumed = true
			return
		}

		if (!session.resumed) {
			this.sendError(session, 'RESUME_REQUIRED', 'A collaboration connection must resume before submitting input.')
			return
		}
		if (parsed.value.proposal.participantId !== session.participantId) {
			this.sendError(session, 'PARTICIPANT_MISMATCH', 'Event proposal participant does not match the authenticated connection.')
			return
		}
		const result = this.room.submit(parsed.value.proposal)
		if (result.ok && !result.duplicate) await this.appendAcceptedEvent(result.event.sequence)
		this.send(session, { wireVersion: COLLABORATION_WIRE_VERSION, type: 'submit-result', result })
		if (result.ok && !result.duplicate) {
			this.broadcast(
				{ wireVersion: COLLABORATION_WIRE_VERSION, type: 'authoritative-event', event: result.event },
				session.socket,
			)
		}
	}

	async start(): Promise<CollaborationServerAddress> {
		if (this.address) return this.address
		await this.saveCheckpoint()
		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error): void => reject(error)
			this.httpServer.once('error', onError)
			this.httpServer.listen(this.port, this.host, () => {
				this.httpServer.off('error', onError)
				resolve()
			})
		})
		const address = this.httpServer.address()
		if (!address || typeof address === 'string') throw new Error('Collaboration server did not acquire a TCP address.')
		this.address = {
			host: this.host,
			port: address.port,
			path: this.path,
			url: `ws://${this.host}:${address.port}${this.path}`,
		}
		return this.address
	}

	private async commitAuthoritativeBoundary(nextStepIndex: number): Promise<void> {
		const previouslyAppliedSequence = this.room.appliedSequence
		this.room.advanceStepIndex(nextStepIndex)
		const shouldCreateSyncPoint = nextStepIndex % this.syncPointIntervalSteps === 0
			|| this.room.appliedSequence !== previouslyAppliedSequence
		const syncPoint = shouldCreateSyncPoint ? await this.room.createSyncPoint() : undefined
		if (nextStepIndex % this.checkpointIntervalSteps === 0) await this.saveCheckpoint()
		this.broadcast({
			wireVersion: COLLABORATION_WIRE_VERSION,
			type: 'authoritative-tick',
			tick: this.room.createTick(syncPoint),
		})
	}

	async runAuthoritativeStep(runSimulationStep: RunAuthoritativeSimulationStep): Promise<void> {
		await this.enqueue(async () => {
			if (this.authorityFailure) throw this.authorityFailure
			const stepIndex = this.room.currentStepIndex
			if (!Number.isSafeInteger(stepIndex + 1)) {
				throw new RangeError('Authoritative collaboration step exceeds the safe integer range.')
			}
			const nextStepIndex = stepIndex + 1
			try {
				await runSimulationStep({ stepIndex, nextStepIndex })
				await this.commitAuthoritativeBoundary(nextStepIndex)
			} catch (error) {
				throw this.poisonAuthority(error)
			}
		})
	}

	async stop(): Promise<void> {
		await this.operationTail
		for (const session of this.sessions) session.socket.terminate()
		this.sessions.clear()
		await new Promise<void>((resolve) => this.webSocketServer.close(() => resolve()))
		if (this.httpServer.listening) {
			await new Promise<void>((resolve, reject) => {
				this.httpServer.close((error) => error ? reject(error) : resolve())
			})
		}
		this.address = undefined
	}
}
