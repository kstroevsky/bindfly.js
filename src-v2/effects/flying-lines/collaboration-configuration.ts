import { normalizeParameters } from '../../core/index.ts'

import { flyingLinesParameters } from './parameters.ts'
import type { FlyingLinesParameters } from './types.ts'

export const FLYING_LINES_COLLABORATION_CONFIGURATION_VERSION = 1

export interface FlyingLinesCollaborationConfiguration {
	readonly seed: string
	readonly parameters: FlyingLinesParameters
	readonly simulationWidth: number
	readonly simulationHeight: number
	readonly fixedStepSeconds: number
}

const MAGIC = new Uint8Array([0x42, 0x46, 0x46, 0x43]) // BFFC
const UINT32_BYTES = 4
const FLOAT64_BYTES = 8

const assertPositiveFinite = (value: number, label: string): void => {
	if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be a positive finite number.`)
}

const normalizeConfiguration = (
	configuration: FlyingLinesCollaborationConfiguration,
): FlyingLinesCollaborationConfiguration => {
	if (configuration.seed.length === 0) throw new Error('Flying Lines collaboration seed must not be empty.')
	assertPositiveFinite(configuration.simulationWidth, 'Flying Lines collaboration simulationWidth')
	assertPositiveFinite(configuration.simulationHeight, 'Flying Lines collaboration simulationHeight')
	assertPositiveFinite(configuration.fixedStepSeconds, 'Flying Lines collaboration fixedStepSeconds')
	const parameters = normalizeParameters(flyingLinesParameters, configuration.parameters)
	if (!parameters.ok) {
		throw new Error(`Flying Lines collaboration parameters are invalid: ${parameters.issues[0]?.message ?? 'unknown issue'}`)
	}
	return { ...configuration, parameters: parameters.value }
}

export const encodeFlyingLinesCollaborationConfigurationV1 = (
	configuration: FlyingLinesCollaborationConfiguration,
): Uint8Array => {
	const normalized = normalizeConfiguration(configuration)
	const seed = new TextEncoder().encode(normalized.seed)
	const background = new TextEncoder().encode(normalized.parameters.background)
	if (seed.byteLength > 0xffff_ffff || background.byteLength > 0xffff_ffff) {
		throw new RangeError('Flying Lines collaboration strings exceed the canonical encoding limit.')
	}
	const byteLength = MAGIC.byteLength + 1
		+ UINT32_BYTES + seed.byteLength
		+ (3 * FLOAT64_BYTES)
		+ UINT32_BYTES
		+ (4 * FLOAT64_BYTES)
		+ UINT32_BYTES + background.byteLength
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
	const writeFloat64 = (value: number): void => {
		view.setFloat64(offset, value, false)
		offset += FLOAT64_BYTES
	}

	writeBytes(MAGIC)
	bytes[offset++] = FLYING_LINES_COLLABORATION_CONFIGURATION_VERSION
	writeUint32(seed.byteLength)
	writeBytes(seed)
	writeFloat64(normalized.simulationWidth)
	writeFloat64(normalized.simulationHeight)
	writeFloat64(normalized.fixedStepSeconds)
	writeUint32(normalized.parameters.particleCount)
	writeFloat64(normalized.parameters.maxSpeed)
	writeFloat64(normalized.parameters.particleLifetimeSeconds)
	writeFloat64(normalized.parameters.margin)
	writeFloat64(normalized.parameters.connectionRadius)
	writeUint32(background.byteLength)
	writeBytes(background)
	return bytes
}

export const decodeFlyingLinesCollaborationConfigurationV1 = (
	bytes: Uint8Array,
): FlyingLinesCollaborationConfiguration => {
	const minimumBytes = MAGIC.byteLength + 1 + UINT32_BYTES + (3 * FLOAT64_BYTES) + UINT32_BYTES + (4 * FLOAT64_BYTES) + UINT32_BYTES
	if (bytes.byteLength < minimumBytes) throw new Error('Flying Lines collaboration configuration is truncated.')
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	let offset = 0
	for (const expected of MAGIC) {
		if (bytes[offset++] !== expected) throw new Error('Flying Lines collaboration configuration magic is invalid.')
	}
	const version = bytes[offset++]
	if (version !== FLYING_LINES_COLLABORATION_CONFIGURATION_VERSION) {
		throw new Error(`Unsupported Flying Lines collaboration configuration version '${version}'.`)
	}
	const readUint32 = (): number => {
		if (offset + UINT32_BYTES > bytes.byteLength) throw new Error('Flying Lines collaboration configuration is truncated.')
		const value = view.getUint32(offset, false)
		offset += UINT32_BYTES
		return value
	}
	const readFloat64 = (): number => {
		if (offset + FLOAT64_BYTES > bytes.byteLength) throw new Error('Flying Lines collaboration configuration is truncated.')
		const value = view.getFloat64(offset, false)
		offset += FLOAT64_BYTES
		return value
	}
	const readString = (): string => {
		const byteLength = readUint32()
		if (offset + byteLength > bytes.byteLength) throw new Error('Flying Lines collaboration configuration string is truncated.')
		const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset, offset + byteLength))
		offset += byteLength
		return value
	}

	const seed = readString()
	const simulationWidth = readFloat64()
	const simulationHeight = readFloat64()
	const fixedStepSeconds = readFloat64()
	const particleCount = readUint32()
	const maxSpeed = readFloat64()
	const particleLifetimeSeconds = readFloat64()
	const margin = readFloat64()
	const connectionRadius = readFloat64()
	const background = readString()
	if (offset !== bytes.byteLength) throw new Error('Flying Lines collaboration configuration has trailing bytes.')
	return normalizeConfiguration({
		seed,
		simulationWidth,
		simulationHeight,
		fixedStepSeconds,
		parameters: {
			particleCount,
			maxSpeed,
			particleLifetimeSeconds,
			margin,
			connectionRadius,
			background,
		},
	})
}
