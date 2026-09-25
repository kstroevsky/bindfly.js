import {
	CANONICAL_SNAPSHOT_ENCODING_VERSION,
	SNAPSHOT_CHECKSUM_ALGORITHM,
} from './protocol.ts'
import type { SnapshotChecksum } from './protocol.ts'

const MAGIC = new TextEncoder().encode('BINDFLY-SNAPSHOT')
const UINT32_BYTES = 4
const UINT64_BYTES = 8

export interface CanonicalSnapshotV1Input {
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly lastSequence: number
	readonly stepIndex: number
	readonly configurationBytes: Uint8Array
	readonly stateBytes: Uint8Array
}

const assertNonEmpty = (value: string, label: string): void => {
	if (value.length === 0) throw new Error(`${label} must not be empty.`)
}

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

const encodedString = (value: string): Uint8Array => new TextEncoder().encode(value)

export const encodeCanonicalSnapshotV1 = (input: CanonicalSnapshotV1Input): Uint8Array => {
	assertNonEmpty(input.roomId, 'Snapshot roomId')
	assertNonEmpty(input.experimentId, 'Snapshot experimentId')
	assertUint32(input.stateVersion, 'Snapshot stateVersion')
	assertSafeInteger(input.lastSequence, 'Snapshot lastSequence')
	assertSafeInteger(input.stepIndex, 'Snapshot stepIndex')

	const room = encodedString(input.roomId)
	const experiment = encodedString(input.experimentId)
	assertUint32(room.byteLength, 'Snapshot roomId byte length')
	assertUint32(experiment.byteLength, 'Snapshot experimentId byte length')
	assertUint32(input.configurationBytes.byteLength, 'Snapshot configuration byte length')
	assertUint32(input.stateBytes.byteLength, 'Snapshot state byte length')

	const byteLength = MAGIC.byteLength
		+ 1
		+ UINT32_BYTES + room.byteLength
		+ UINT32_BYTES + experiment.byteLength
		+ UINT32_BYTES
		+ UINT64_BYTES
		+ UINT64_BYTES
		+ UINT32_BYTES + input.configurationBytes.byteLength
		+ UINT32_BYTES + input.stateBytes.byteLength
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
	bytes[offset++] = CANONICAL_SNAPSHOT_ENCODING_VERSION
	writeLengthPrefixed(room)
	writeLengthPrefixed(experiment)
	writeUint32(input.stateVersion)
	writeUint64(input.lastSequence)
	writeUint64(input.stepIndex)
	writeLengthPrefixed(input.configurationBytes)
	writeLengthPrefixed(input.stateBytes)

	return bytes
}

export const createSnapshotChecksum = async (bytes: Uint8Array): Promise<SnapshotChecksum> => {
	const subtle = globalThis.crypto?.subtle
	if (!subtle) throw new Error('SHA-256 requires Web Crypto SubtleCrypto support.')
	const digest = new Uint8Array(await subtle.digest('SHA-256', bytes))
	return {
		algorithm: SNAPSHOT_CHECKSUM_ALGORITHM,
		encodingVersion: CANONICAL_SNAPSHOT_ENCODING_VERSION,
		value: Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(''),
	}
}

export const snapshotChecksumsEqual = (left: SnapshotChecksum, right: SnapshotChecksum): boolean =>
	left.algorithm === right.algorithm
	&& left.encodingVersion === right.encodingVersion
	&& left.value === right.value
