import { dirname } from 'node:path'
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises'

import type {
	AUTHORITATIVE_ROOM_PERSISTENCE_VERSION,
	AuthoritativeRoomCheckpoint,
	AuthoritativeRoomPersistenceState,
	AuthoritativeSnapshot,
	COLLABORATION_PROTOCOL_VERSION,
	EventLogHash,
	InMemoryAuthoritativeRoomOptions,
	PersistedAuthoritativeEvent,
	SnapshotChecksum,
} from '../../../src-v2/collaboration/index.ts'
import {
	CANONICAL_SNAPSHOT_ENCODING_VERSION,
	EVENT_LOG_GENESIS_HASH,
	EVENT_LOG_HASH_ALGORITHM,
	EVENT_LOG_HASH_ENCODING_VERSION,
	InMemoryAuthoritativeRoom,
	SNAPSHOT_CHECKSUM_ALGORITHM,
	createEventLogHash,
	eventLogHashesEqual,
} from '../../../src-v2/collaboration/index.ts'

const DEFAULT_MAX_STORE_BYTES = 16 * 1024 * 1024

export interface AuthoritativeRoomStateStore {
	load(): Promise<AuthoritativeRoomPersistenceState | undefined>
	appendEvent(event: PersistedAuthoritativeEvent): Promise<void>
	saveCheckpoint(checkpoint: AuthoritativeRoomCheckpoint): Promise<void>
	delete(): Promise<void>
}

export const loadOrCreateAuthoritativeRoom = async <Input>(
	options: InMemoryAuthoritativeRoomOptions<Input>,
	store: AuthoritativeRoomStateStore,
): Promise<InMemoryAuthoritativeRoom<Input>> => {
	const persisted = await store.load()
	return persisted
		? InMemoryAuthoritativeRoom.recover(options, persisted)
		: new InMemoryAuthoritativeRoom(options)
}

interface StoredSnapshot {
	readonly protocolVersion: number
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly lastAppliedSequence: number
	readonly stepIndex: number
	readonly configurationBase64Url: string
	readonly stateBase64Url: string
	readonly checksum: SnapshotChecksum
}

interface StoredEvent {
	readonly protocolVersion: number
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly participantId: string
	readonly clientEventId: string
	readonly sequence: number
	readonly stepIndex: number
	readonly inputBase64Url: string
}

interface StoredCheckpoint {
	readonly persistenceVersion: number
	readonly inputLeadSteps: number
	readonly snapshot: StoredSnapshot
	readonly eventCount: number
	readonly eventLogHeadHash: EventLogHash
}

interface StoredEventLine {
	readonly previousHash: EventLogHash
	readonly hash: EventLogHash
	readonly event: StoredEvent
}

interface EventLogReadResult {
	readonly events: readonly PersistedAuthoritativeEvent[]
	readonly prefixHashes: readonly EventLogHash[]
	readonly headHash: EventLogHash
	readonly byteLength: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const isEnoent = (error: unknown): boolean => isRecord(error) && error.code === 'ENOENT'

const bytesToBase64Url = (bytes: Uint8Array): string =>
	Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64url')

const base64UrlToBytes = (value: unknown, label: string): Uint8Array => {
	if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/u.test(value) || value.length % 4 === 1) {
		throw new Error(`${label} is not canonical base64url.`)
	}
	const bytes = new Uint8Array(Buffer.from(value, 'base64url'))
	if (bytesToBase64Url(bytes) !== value) throw new Error(`${label} is not canonical base64url.`)
	return bytes
}

const parseSnapshotChecksum = (value: unknown): SnapshotChecksum => {
	if (!isRecord(value)
		|| value.algorithm !== SNAPSHOT_CHECKSUM_ALGORITHM
		|| value.encodingVersion !== CANONICAL_SNAPSHOT_ENCODING_VERSION
		|| typeof value.value !== 'string'
		|| !/^[0-9a-f]{64}$/u.test(value.value)) {
		throw new Error('Stored authoritative snapshot checksum is malformed.')
	}
	return {
		algorithm: SNAPSHOT_CHECKSUM_ALGORITHM,
		encodingVersion: CANONICAL_SNAPSHOT_ENCODING_VERSION,
		value: value.value,
	}
}

const parseEventLogHash = (value: unknown): EventLogHash => {
	if (!isRecord(value)
		|| value.algorithm !== EVENT_LOG_HASH_ALGORITHM
		|| value.encodingVersion !== EVENT_LOG_HASH_ENCODING_VERSION
		|| typeof value.value !== 'string'
		|| !/^[0-9a-f]{64}$/u.test(value.value)) {
		throw new Error('Stored authoritative event-log hash is malformed.')
	}
	return {
		algorithm: EVENT_LOG_HASH_ALGORITHM,
		encodingVersion: EVENT_LOG_HASH_ENCODING_VERSION,
		value: value.value,
	}
}

const requiredString = (record: Record<string, unknown>, key: string): string => {
	const value = record[key]
	if (typeof value !== 'string') throw new Error(`Stored room field '${key}' must be a string.`)
	return value
}

const requiredNumber = (record: Record<string, unknown>, key: string): number => {
	const value = record[key]
	if (typeof value !== 'number') throw new Error(`Stored room field '${key}' must be a number.`)
	return value
}

const parseSnapshot = (value: unknown): AuthoritativeSnapshot => {
	if (!isRecord(value)) throw new Error('Stored authoritative snapshot is malformed.')
	return {
		protocolVersion: requiredNumber(value, 'protocolVersion') as typeof COLLABORATION_PROTOCOL_VERSION,
		roomId: requiredString(value, 'roomId'),
		experimentId: requiredString(value, 'experimentId'),
		stateVersion: requiredNumber(value, 'stateVersion'),
		lastAppliedSequence: requiredNumber(value, 'lastAppliedSequence'),
		stepIndex: requiredNumber(value, 'stepIndex'),
		configurationBytes: base64UrlToBytes(value.configurationBase64Url, 'Stored snapshot configuration'),
		stateBytes: base64UrlToBytes(value.stateBase64Url, 'Stored snapshot state'),
		checksum: parseSnapshotChecksum(value.checksum),
	}
}

const parseEvent = (value: unknown): PersistedAuthoritativeEvent => {
	if (!isRecord(value)) throw new Error('Stored authoritative event is malformed.')
	return {
		protocolVersion: requiredNumber(value, 'protocolVersion') as typeof COLLABORATION_PROTOCOL_VERSION,
		roomId: requiredString(value, 'roomId'),
		experimentId: requiredString(value, 'experimentId'),
		stateVersion: requiredNumber(value, 'stateVersion'),
		participantId: requiredString(value, 'participantId'),
		clientEventId: requiredString(value, 'clientEventId'),
		sequence: requiredNumber(value, 'sequence'),
		stepIndex: requiredNumber(value, 'stepIndex'),
		inputBytes: base64UrlToBytes(value.inputBase64Url, 'Stored authoritative event input'),
	}
}

const snapshotToStored = (snapshot: AuthoritativeSnapshot): StoredSnapshot => ({
	protocolVersion: snapshot.protocolVersion,
	roomId: snapshot.roomId,
	experimentId: snapshot.experimentId,
	stateVersion: snapshot.stateVersion,
	lastAppliedSequence: snapshot.lastAppliedSequence,
	stepIndex: snapshot.stepIndex,
	configurationBase64Url: bytesToBase64Url(snapshot.configurationBytes),
	stateBase64Url: bytesToBase64Url(snapshot.stateBytes),
	checksum: snapshot.checksum,
})

const eventToStored = (event: PersistedAuthoritativeEvent): StoredEvent => ({
	protocolVersion: event.protocolVersion,
	roomId: event.roomId,
	experimentId: event.experimentId,
	stateVersion: event.stateVersion,
	participantId: event.participantId,
	clientEventId: event.clientEventId,
	sequence: event.sequence,
	stepIndex: event.stepIndex,
	inputBase64Url: bytesToBase64Url(event.inputBytes),
})

const parseStoredCheckpoint = (text: string): StoredCheckpoint => {
	let value: unknown
	try {
		value = JSON.parse(text)
	} catch {
		throw new Error('Stored authoritative room checkpoint is not valid JSON.')
	}
	if (!isRecord(value)) throw new Error('Stored authoritative room checkpoint is malformed.')
	return {
		persistenceVersion: requiredNumber(value, 'persistenceVersion'),
		inputLeadSteps: requiredNumber(value, 'inputLeadSteps'),
		snapshot: snapshotToStored(parseSnapshot(value.snapshot)),
		eventCount: requiredNumber(value, 'eventCount'),
		eventLogHeadHash: parseEventLogHash(value.eventLogHeadHash),
	}
}

const parseStoredEventLine = (text: string): StoredEventLine => {
	let value: unknown
	try {
		value = JSON.parse(text)
	} catch {
		throw new Error('Stored authoritative event-log line is not valid JSON.')
	}
	if (!isRecord(value)) throw new Error('Stored authoritative event-log line is malformed.')
	return {
		previousHash: parseEventLogHash(value.previousHash),
		hash: parseEventLogHash(value.hash),
		event: eventToStored(parseEvent(value.event)),
	}
}

const fileSize = async (path: string): Promise<number> => {
	try {
		return (await stat(path)).size
	} catch (error) {
		if (isEnoent(error)) return 0
		throw error
	}
}

const fileExists = async (path: string): Promise<boolean> => {
	try {
		await stat(path)
		return true
	} catch (error) {
		if (isEnoent(error)) return false
		throw error
	}
}

export class FileAuthoritativeRoomStateStore implements AuthoritativeRoomStateStore {
	private readonly checkpointPath: string
	private readonly eventLogPath: string
	private readonly maxStoreBytes: number
	private temporaryCounter = 0
	private eventCount: number | undefined
	private eventLogHeadHash: EventLogHash | undefined

	constructor(filePath: string, options: { readonly maxStoreBytes?: number } = {}) {
		if (filePath.length === 0) throw new Error('Authoritative room store path must not be empty.')
		const maxStoreBytes = options.maxStoreBytes ?? DEFAULT_MAX_STORE_BYTES
		if (!Number.isSafeInteger(maxStoreBytes) || maxStoreBytes <= 0) {
			throw new RangeError('Authoritative room maxStoreBytes must be a positive safe integer.')
		}
		this.checkpointPath = filePath
		this.eventLogPath = `${filePath}.events`
		this.maxStoreBytes = maxStoreBytes
	}

	private async readEventLog(): Promise<EventLogReadResult> {
		let handle: Awaited<ReturnType<typeof open>>
		try {
			handle = await open(this.eventLogPath, 'r+')
		} catch (error) {
			if (isEnoent(error)) {
				return { events: [], prefixHashes: [EVENT_LOG_GENESIS_HASH], headHash: EVENT_LOG_GENESIS_HASH, byteLength: 0 }
			}
			throw error
		}
		try {
			const fileStat = await handle.stat()
			if (fileStat.size > this.maxStoreBytes) throw new Error(`Authoritative room store exceeds ${this.maxStoreBytes} bytes.`)
			const bytes = await handle.readFile()
			if (bytes.byteLength > this.maxStoreBytes) throw new Error(`Authoritative room store exceeds ${this.maxStoreBytes} bytes.`)
			const completeByteLength = bytes.byteLength === 0 || bytes[bytes.byteLength - 1] === 0x0a
				? bytes.byteLength
				: bytes.lastIndexOf(0x0a) + 1
			const text = bytes.subarray(0, completeByteLength).toString('utf8')
			const lines = text.length === 0 ? [] : text.split('\n').filter((line) => line.length > 0)
			const events: PersistedAuthoritativeEvent[] = []
			const prefixHashes: EventLogHash[] = [EVENT_LOG_GENESIS_HASH]
			let previousHash = EVENT_LOG_GENESIS_HASH
			for (const [index, line] of lines.entries()) {
				const stored = parseStoredEventLine(line)
				if (!eventLogHashesEqual(stored.previousHash, previousHash)) {
					throw new Error(`Stored authoritative event-log chain is broken before event ${index + 1}.`)
				}
				const event = parseEvent(stored.event)
				if (event.sequence !== index + 1) {
					throw new Error(`Stored authoritative event-log sequence ${event.sequence} is not contiguous.`)
				}
				const expectedHash = await createEventLogHash(previousHash, event)
				if (!eventLogHashesEqual(expectedHash, stored.hash)) {
					throw new Error(`Stored authoritative event-log integrity verification failed at event ${event.sequence}.`)
				}
				events.push(event)
				previousHash = expectedHash
				prefixHashes.push(expectedHash)
			}
			if (completeByteLength !== bytes.byteLength) {
				await handle.truncate(completeByteLength)
				await handle.sync()
			}
			return { events, prefixHashes, headHash: previousHash, byteLength: completeByteLength }
		} finally {
			await handle.close()
		}
	}

	private async ensureEventCursor(): Promise<void> {
		if (this.eventCount !== undefined && this.eventLogHeadHash !== undefined) return
		const eventLog = await this.readEventLog()
		this.eventCount = eventLog.events.length
		this.eventLogHeadHash = eventLog.headHash
	}

	async load(): Promise<AuthoritativeRoomPersistenceState | undefined> {
		let handle: Awaited<ReturnType<typeof open>>
		try {
			handle = await open(this.checkpointPath, 'r')
		} catch (error) {
			if (isEnoent(error)) {
				if (await fileSize(this.eventLogPath) > 0) throw new Error('Authoritative event log exists without a room checkpoint.')
				this.eventCount = 0
				this.eventLogHeadHash = EVENT_LOG_GENESIS_HASH
				return undefined
			}
			throw error
		}
		try {
			const checkpointStat = await handle.stat()
			const eventLogSize = await fileSize(this.eventLogPath)
			if (checkpointStat.size + eventLogSize > this.maxStoreBytes) {
				throw new Error(`Authoritative room store exceeds ${this.maxStoreBytes} bytes.`)
			}
			const checkpointBytes = await handle.readFile()
			const stored = parseStoredCheckpoint(checkpointBytes.toString('utf8'))
			const eventLog = await this.readEventLog()
			if (!Number.isSafeInteger(stored.eventCount) || stored.eventCount < 0 || stored.eventCount > eventLog.events.length) {
				throw new Error('Stored authoritative checkpoint event count is inconsistent with the event log.')
			}
			const checkpointHead = eventLog.prefixHashes[stored.eventCount]
			if (!checkpointHead || !eventLogHashesEqual(stored.eventLogHeadHash, checkpointHead)) {
				throw new Error('Stored authoritative checkpoint is not linked to the event-log prefix it records.')
			}
			this.eventCount = eventLog.events.length
			this.eventLogHeadHash = eventLog.headHash
			return {
				persistenceVersion: stored.persistenceVersion as typeof AUTHORITATIVE_ROOM_PERSISTENCE_VERSION,
				inputLeadSteps: stored.inputLeadSteps,
				snapshot: parseSnapshot(stored.snapshot),
				events: eventLog.events,
				eventLogHeadHash: eventLog.headHash,
			}
		} finally {
			await handle.close()
		}
	}

	async appendEvent(event: PersistedAuthoritativeEvent): Promise<void> {
		await this.ensureEventCursor()
		const eventCount = this.eventCount ?? 0
		const previousHash = this.eventLogHeadHash ?? EVENT_LOG_GENESIS_HASH
		if (event.sequence !== eventCount + 1) {
			throw new Error(`Authoritative event ${event.sequence} cannot append after durable sequence ${eventCount}.`)
		}
		const hash = await createEventLogHash(previousHash, event)
		const line = `${JSON.stringify({ previousHash, hash, event: eventToStored(event) } satisfies StoredEventLine)}\n`
		const checkpointBytes = await fileSize(this.checkpointPath)
		const eventBytes = await fileSize(this.eventLogPath)
		if (checkpointBytes + eventBytes + Buffer.byteLength(line) > this.maxStoreBytes) {
			throw new Error(`Authoritative room store exceeds ${this.maxStoreBytes} bytes.`)
		}
		const directory = dirname(this.eventLogPath)
		await mkdir(directory, { recursive: true })
		const eventLogExisted = await fileExists(this.eventLogPath)
		const handle = await open(this.eventLogPath, 'a', 0o600)
		try {
			await handle.writeFile(line, 'utf8')
			await handle.sync()
		} finally {
			await handle.close()
		}
		if (!eventLogExisted) {
			const directoryHandle = await open(directory, 'r')
			try { await directoryHandle.sync() } finally { await directoryHandle.close() }
		}
		this.eventCount = eventCount + 1
		this.eventLogHeadHash = hash
	}

	async saveCheckpoint(checkpoint: AuthoritativeRoomCheckpoint): Promise<void> {
		await this.ensureEventCursor()
		const eventCount = this.eventCount ?? 0
		const eventLogHeadHash = this.eventLogHeadHash ?? EVENT_LOG_GENESIS_HASH
		if (checkpoint.eventCount !== eventCount) {
			throw new Error(`Authoritative checkpoint event count ${checkpoint.eventCount} does not match durable log head ${eventCount}.`)
		}
		const stored: StoredCheckpoint = {
			persistenceVersion: checkpoint.persistenceVersion,
			inputLeadSteps: checkpoint.inputLeadSteps,
			snapshot: snapshotToStored(checkpoint.snapshot),
			eventCount,
			eventLogHeadHash,
		}
		const serialized = `${JSON.stringify(stored)}\n`
		const eventBytes = await fileSize(this.eventLogPath)
		if (Buffer.byteLength(serialized) + eventBytes > this.maxStoreBytes) {
			throw new Error(`Authoritative room store exceeds ${this.maxStoreBytes} bytes.`)
		}
		const directory = dirname(this.checkpointPath)
		await mkdir(directory, { recursive: true })
		const temporaryPath = `${this.checkpointPath}.${process.pid}.${this.temporaryCounter++}.tmp`
		let handle: Awaited<ReturnType<typeof open>> | undefined
		try {
			handle = await open(temporaryPath, 'wx', 0o600)
			await handle.writeFile(serialized, 'utf8')
			await handle.sync()
			await handle.close()
			handle = undefined
			await rename(temporaryPath, this.checkpointPath)
			const directoryHandle = await open(directory, 'r')
			try { await directoryHandle.sync() } finally { await directoryHandle.close() }
		} catch (error) {
			if (handle) await handle.close().catch(() => undefined)
			await unlink(temporaryPath).catch(() => undefined)
			throw error
		}
	}

	async delete(): Promise<void> {
		await Promise.all([this.checkpointPath, this.eventLogPath].map(async (path) => {
			await unlink(path).catch((error: unknown) => {
				if (!isEnoent(error)) throw error
			})
		}))
		this.eventCount = 0
		this.eventLogHeadHash = EVENT_LOG_GENESIS_HASH
	}
}
