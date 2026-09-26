import {
	EVENT_LOG_HASH_ALGORITHM,
	EVENT_LOG_HASH_ENCODING_VERSION,
} from './protocol.ts'
import type { EventLogHash, PersistedAuthoritativeEvent } from './protocol.ts'

const MAGIC = new TextEncoder().encode('BINDFLY-EVENT-LOG')
const UINT32_BYTES = 4
const UINT64_BYTES = 8

export const EVENT_LOG_GENESIS_HASH: EventLogHash = Object.freeze({
	algorithm: EVENT_LOG_HASH_ALGORITHM,
	encodingVersion: EVENT_LOG_HASH_ENCODING_VERSION,
	value: '0'.repeat(64),
})

const encodedString = (value: string): Uint8Array => new TextEncoder().encode(value)

const hexToBytes = (value: string): Uint8Array => {
	if (!/^[0-9a-f]{64}$/u.test(value)) throw new Error('Event-log hash must be 32-byte lowercase hexadecimal.')
	const bytes = new Uint8Array(32)
	for (let index = 0; index < bytes.length; index++) {
		bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
	}
	return bytes
}

const bytesToHex = (bytes: Uint8Array): string =>
	Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

const assertUint32 = (value: number, label: string): void => {
	if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
		throw new RangeError(`${label} must be an unsigned 32-bit integer.`)
	}
}

const assertSafeInteger = (value: number, label: string): void => {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new RangeError(`${label} must be a non-negative safe integer.`)
	}
}

export const encodeCanonicalPersistedEventV1 = (
	previousHash: EventLogHash,
	event: PersistedAuthoritativeEvent,
): Uint8Array => {
	if (previousHash.algorithm !== EVENT_LOG_HASH_ALGORITHM
		|| previousHash.encodingVersion !== EVENT_LOG_HASH_ENCODING_VERSION) {
		throw new Error('Event-log previous hash uses an unsupported identity contract.')
	}
	const previousHashBytes = hexToBytes(previousHash.value)
	const room = encodedString(event.roomId)
	const experiment = encodedString(event.experimentId)
	const participant = encodedString(event.participantId)
	const clientEvent = encodedString(event.clientEventId)
	for (const [label, bytes] of [
		['roomId', room],
		['experimentId', experiment],
		['participantId', participant],
		['clientEventId', clientEvent],
		['input', event.inputBytes],
	] as const) assertUint32(bytes.byteLength, `Persisted event ${label} byte length`)
	assertUint32(event.protocolVersion, 'Persisted event protocolVersion')
	assertUint32(event.stateVersion, 'Persisted event stateVersion')
	assertSafeInteger(event.sequence, 'Persisted event sequence')
	assertSafeInteger(event.stepIndex, 'Persisted event stepIndex')

	const byteLength = MAGIC.byteLength + 1 + previousHashBytes.byteLength
		+ UINT32_BYTES + room.byteLength
		+ UINT32_BYTES + experiment.byteLength
		+ UINT32_BYTES + UINT32_BYTES
		+ UINT32_BYTES + participant.byteLength
		+ UINT32_BYTES + clientEvent.byteLength
		+ UINT64_BYTES + UINT64_BYTES
		+ UINT32_BYTES + event.inputBytes.byteLength
	const bytes = new Uint8Array(byteLength)
	const view = new DataView(bytes.buffer)
	let offset = 0
	const writeBytes = (value: Uint8Array): void => {
		bytes.set(value, offset)
		offset += value.byteLength
	}
	const writeUint32 = (value: number): void => {
		view.setUint32(offset, value, false)
		offset += UINT32_BYTES
	}
	const writeUint64 = (value: number): void => {
		view.setBigUint64(offset, BigInt(value), false)
		offset += UINT64_BYTES
	}
	const writeLengthPrefixed = (value: Uint8Array): void => {
		writeUint32(value.byteLength)
		writeBytes(value)
	}

	writeBytes(MAGIC)
	bytes[offset++] = EVENT_LOG_HASH_ENCODING_VERSION
	writeBytes(previousHashBytes)
	writeLengthPrefixed(room)
	writeLengthPrefixed(experiment)
	writeUint32(event.protocolVersion)
	writeUint32(event.stateVersion)
	writeLengthPrefixed(participant)
	writeLengthPrefixed(clientEvent)
	writeUint64(event.sequence)
	writeUint64(event.stepIndex)
	writeLengthPrefixed(event.inputBytes)
	return bytes
}

export const createEventLogHash = async (
	previousHash: EventLogHash,
	event: PersistedAuthoritativeEvent,
): Promise<EventLogHash> => {
	const subtle = globalThis.crypto?.subtle
	if (!subtle) throw new Error('SHA-256 requires Web Crypto SubtleCrypto support.')
	const digest = new Uint8Array(await subtle.digest('SHA-256', encodeCanonicalPersistedEventV1(previousHash, event)))
	return {
		algorithm: EVENT_LOG_HASH_ALGORITHM,
		encodingVersion: EVENT_LOG_HASH_ENCODING_VERSION,
		value: bytesToHex(digest),
	}
}

export const createEventLogHeadHash = async (
	events: readonly PersistedAuthoritativeEvent[],
): Promise<EventLogHash> => {
	let hash = EVENT_LOG_GENESIS_HASH
	for (const event of events) hash = await createEventLogHash(hash, event)
	return hash
}

export const eventLogHashesEqual = (left: EventLogHash, right: EventLogHash): boolean =>
	left.algorithm === right.algorithm
	&& left.encodingVersion === right.encodingVersion
	&& left.value === right.value
