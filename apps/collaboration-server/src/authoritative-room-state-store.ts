import { dirname } from 'node:path'
import { mkdir, open, rename, unlink } from 'node:fs/promises'

import type {
	AUTHORITATIVE_ROOM_PERSISTENCE_VERSION,
	AuthoritativeRoomPersistenceState,
	AuthoritativeSnapshot,
	COLLABORATION_PROTOCOL_VERSION,
	InMemoryAuthoritativeRoomOptions,
	PersistedAuthoritativeEvent,
	SnapshotChecksum,
} from '../../../src-v2/collaboration/index.ts'
import {
	CANONICAL_SNAPSHOT_ENCODING_VERSION,
	InMemoryAuthoritativeRoom,
	SNAPSHOT_CHECKSUM_ALGORITHM,
} from '../../../src-v2/collaboration/index.ts'

const DEFAULT_MAX_STORE_BYTES = 16 * 1024 * 1024

export interface AuthoritativeRoomStateStore {
	load(): Promise<AuthoritativeRoomPersistenceState | undefined>
	save(state: AuthoritativeRoomPersistenceState): Promise<void>
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

interface StoredRoomState {
	readonly persistenceVersion: number
	readonly inputLeadSteps: number
	readonly snapshot: StoredSnapshot
	readonly events: readonly StoredEvent[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

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

const parseChecksum = (value: unknown): SnapshotChecksum => {
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
		checksum: parseChecksum(value.checksum),
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

const parseStoredRoomState = (text: string): AuthoritativeRoomPersistenceState => {
	let value: unknown
	try {
		value = JSON.parse(text)
	} catch {
		throw new Error('Stored authoritative room state is not valid JSON.')
	}
	if (!isRecord(value) || !Array.isArray(value.events)) throw new Error('Stored authoritative room state is malformed.')
	return {
		persistenceVersion: requiredNumber(value, 'persistenceVersion') as typeof AUTHORITATIVE_ROOM_PERSISTENCE_VERSION,
		inputLeadSteps: requiredNumber(value, 'inputLeadSteps'),
		snapshot: parseSnapshot(value.snapshot),
		events: value.events.map(parseEvent),
	}
}

const serializeState = (state: AuthoritativeRoomPersistenceState): string => {
	const stored: StoredRoomState = {
		persistenceVersion: state.persistenceVersion,
		inputLeadSteps: state.inputLeadSteps,
		snapshot: {
			protocolVersion: state.snapshot.protocolVersion,
			roomId: state.snapshot.roomId,
			experimentId: state.snapshot.experimentId,
			stateVersion: state.snapshot.stateVersion,
			lastAppliedSequence: state.snapshot.lastAppliedSequence,
			stepIndex: state.snapshot.stepIndex,
			configurationBase64Url: bytesToBase64Url(state.snapshot.configurationBytes),
			stateBase64Url: bytesToBase64Url(state.snapshot.stateBytes),
			checksum: state.snapshot.checksum,
		},
		events: state.events.map((event) => ({
			protocolVersion: event.protocolVersion,
			roomId: event.roomId,
			experimentId: event.experimentId,
			stateVersion: event.stateVersion,
			participantId: event.participantId,
			clientEventId: event.clientEventId,
			sequence: event.sequence,
			stepIndex: event.stepIndex,
			inputBase64Url: bytesToBase64Url(event.inputBytes),
		})),
	}
	return `${JSON.stringify(stored)}\n`
}

export class FileAuthoritativeRoomStateStore implements AuthoritativeRoomStateStore {
	private readonly filePath: string
	private readonly maxStoreBytes: number
	private temporaryCounter = 0

	constructor(filePath: string, options: { readonly maxStoreBytes?: number } = {}) {
		if (filePath.length === 0) throw new Error('Authoritative room store path must not be empty.')
		const maxStoreBytes = options.maxStoreBytes ?? DEFAULT_MAX_STORE_BYTES
		if (!Number.isSafeInteger(maxStoreBytes) || maxStoreBytes <= 0) {
			throw new RangeError('Authoritative room maxStoreBytes must be a positive safe integer.')
		}
		this.filePath = filePath
		this.maxStoreBytes = maxStoreBytes
	}

	async load(): Promise<AuthoritativeRoomPersistenceState | undefined> {
		let handle: Awaited<ReturnType<typeof open>>
		try {
			handle = await open(this.filePath, 'r')
		} catch (error) {
			if (isRecord(error) && error.code === 'ENOENT') return undefined
			throw error
		}
		try {
			const size = (await handle.stat()).size
			if (size > this.maxStoreBytes) throw new Error(`Authoritative room store exceeds ${this.maxStoreBytes} bytes.`)
			const bytes = await handle.readFile()
			if (bytes.byteLength > this.maxStoreBytes) throw new Error(`Authoritative room store exceeds ${this.maxStoreBytes} bytes.`)
			return parseStoredRoomState(bytes.toString('utf8'))
		} finally {
			await handle.close()
		}
	}

	async save(state: AuthoritativeRoomPersistenceState): Promise<void> {
		const serialized = serializeState(state)
		const byteLength = Buffer.byteLength(serialized)
		if (byteLength > this.maxStoreBytes) throw new Error(`Authoritative room store exceeds ${this.maxStoreBytes} bytes.`)
		const directory = dirname(this.filePath)
		await mkdir(directory, { recursive: true })
		const temporaryPath = `${this.filePath}.${process.pid}.${this.temporaryCounter++}.tmp`
		let handle: Awaited<ReturnType<typeof open>> | undefined
		try {
			handle = await open(temporaryPath, 'wx', 0o600)
			await handle.writeFile(serialized, 'utf8')
			await handle.sync()
			await handle.close()
			handle = undefined
			await rename(temporaryPath, this.filePath)
			const directoryHandle = await open(directory, 'r')
			try { await directoryHandle.sync() } finally { await directoryHandle.close() }
		} catch (error) {
			if (handle) await handle.close().catch(() => undefined)
			await unlink(temporaryPath).catch(() => undefined)
			throw error
		}
	}

	async delete(): Promise<void> {
		await unlink(this.filePath).catch((error: unknown) => {
			if (!isRecord(error) || error.code !== 'ENOENT') throw error
		})
	}
}
