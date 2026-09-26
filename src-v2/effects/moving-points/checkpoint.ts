import { SEEDED_RANDOM_ALGORITHM } from '../../core/random.ts'
import type { SeededRandomSnapshot } from '../../core/random.ts'

import type { MovingPointState } from './types.ts'

export const MOVING_POINT_CHECKPOINT_VERSION = 1

export interface MovingPointCheckpoint {
	readonly version: typeof MOVING_POINT_CHECKPOINT_VERSION
	readonly random: SeededRandomSnapshot
	readonly nextId: number
	readonly particles: MovingPointState['particles']
}

const MAGIC = new Uint8Array([0x42, 0x46, 0x4d, 0x50]) // BFMP
const HEADER_BYTES = MAGIC.byteLength + 1 + 2 + SEEDED_RANDOM_ALGORITHM.length + 4 + 4 + 4
const PARTICLE_BYTES = 4 + (5 * 8)

const assertUint32 = (value: number, label: string): void => {
	if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
		throw new RangeError(`${label} must be an unsigned 32-bit integer.`)
	}
}

const assertFiniteRange = (values: Float64Array, count: number, label: string): void => {
	for (let index = 0; index < count; index++) {
		if (!Number.isFinite(values[index])) throw new RangeError(`${label}[${index}] must be finite.`)
	}
}

export const assertMovingPointCheckpoint = (checkpoint: MovingPointCheckpoint): void => {
	if (checkpoint.version !== MOVING_POINT_CHECKPOINT_VERSION) throw new Error('Unsupported moving-point checkpoint version.')
	if (checkpoint.random.algorithm !== SEEDED_RANDOM_ALGORITHM) throw new Error('Unsupported moving-point checkpoint random algorithm.')
	assertUint32(checkpoint.random.state, 'Moving-point checkpoint random state')
	assertUint32(checkpoint.nextId, 'Moving-point checkpoint nextId')
	const { particles } = checkpoint
	assertUint32(particles.count, 'Moving-point checkpoint particle count')
	if (particles.capacity < particles.count) throw new RangeError('Moving-point checkpoint capacity is smaller than particle count.')
	if (particles.ids.length < particles.count
		|| particles.x.length < particles.count
		|| particles.y.length < particles.count
		|| particles.velocityX.length < particles.count
		|| particles.velocityY.length < particles.count
		|| particles.lifeSeconds.length < particles.count) {
		throw new RangeError('Moving-point checkpoint arrays do not cover the active particle range.')
	}
	assertFiniteRange(particles.x, particles.count, 'Moving-point checkpoint x')
	assertFiniteRange(particles.y, particles.count, 'Moving-point checkpoint y')
	assertFiniteRange(particles.velocityX, particles.count, 'Moving-point checkpoint velocityX')
	assertFiniteRange(particles.velocityY, particles.count, 'Moving-point checkpoint velocityY')
	assertFiniteRange(particles.lifeSeconds, particles.count, 'Moving-point checkpoint lifeSeconds')
	let maximumId = -1
	for (let index = 0; index < particles.count; index++) maximumId = Math.max(maximumId, particles.ids[index] ?? 0)
	if (particles.count > 0 && checkpoint.nextId <= maximumId) {
		throw new RangeError('Moving-point checkpoint nextId must be greater than every active particle ID.')
	}
}

export const encodeMovingPointCheckpointV1 = (checkpoint: MovingPointCheckpoint): Uint8Array => {
	assertMovingPointCheckpoint(checkpoint)
	const algorithm = new TextEncoder().encode(checkpoint.random.algorithm)
	const byteLength = MAGIC.byteLength + 1 + 2 + algorithm.byteLength + 4 + 4 + 4
		+ (checkpoint.particles.count * PARTICLE_BYTES)
	const bytes = new Uint8Array(byteLength)
	const view = new DataView(bytes.buffer)
	let offset = 0
	bytes.set(MAGIC, offset)
	offset += MAGIC.byteLength
	bytes[offset++] = MOVING_POINT_CHECKPOINT_VERSION
	view.setUint16(offset, algorithm.byteLength, false)
	offset += 2
	bytes.set(algorithm, offset)
	offset += algorithm.byteLength
	view.setUint32(offset, checkpoint.random.state, false)
	offset += 4
	view.setUint32(offset, checkpoint.nextId, false)
	offset += 4
	view.setUint32(offset, checkpoint.particles.count, false)
	offset += 4

	for (let index = 0; index < checkpoint.particles.count; index++) {
		view.setUint32(offset, checkpoint.particles.ids[index] ?? 0, false)
		offset += 4
		for (const value of [
			checkpoint.particles.x[index] ?? 0,
			checkpoint.particles.y[index] ?? 0,
			checkpoint.particles.velocityX[index] ?? 0,
			checkpoint.particles.velocityY[index] ?? 0,
			checkpoint.particles.lifeSeconds[index] ?? 0,
		]) {
			view.setFloat64(offset, value, false)
			offset += 8
		}
	}
	return bytes
}

export const decodeMovingPointCheckpointV1 = (bytes: Uint8Array): MovingPointCheckpoint => {
	if (bytes.byteLength < HEADER_BYTES) throw new Error('Moving-point checkpoint is truncated.')
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	let offset = 0
	for (const expected of MAGIC) {
		if (bytes[offset++] !== expected) throw new Error('Moving-point checkpoint magic is invalid.')
	}
	const version = bytes[offset++]
	if (version !== MOVING_POINT_CHECKPOINT_VERSION) throw new Error(`Unsupported moving-point checkpoint version '${version}'.`)
	const algorithmLength = view.getUint16(offset, false)
	offset += 2
	if (offset + algorithmLength + 12 > bytes.byteLength) throw new Error('Moving-point checkpoint header is truncated.')
	const algorithm = new TextDecoder().decode(bytes.subarray(offset, offset + algorithmLength))
	offset += algorithmLength
	if (algorithm !== SEEDED_RANDOM_ALGORITHM) throw new Error(`Unsupported moving-point checkpoint random algorithm '${algorithm}'.`)
	const randomState = view.getUint32(offset, false)
	offset += 4
	const nextId = view.getUint32(offset, false)
	offset += 4
	const count = view.getUint32(offset, false)
	offset += 4
	const expectedLength = offset + (count * PARTICLE_BYTES)
	if (expectedLength !== bytes.byteLength) throw new Error('Moving-point checkpoint byte length does not match its particle count.')

	const ids = new Uint32Array(count)
	const x = new Float64Array(count)
	const y = new Float64Array(count)
	const velocityX = new Float64Array(count)
	const velocityY = new Float64Array(count)
	const lifeSeconds = new Float64Array(count)
	for (let index = 0; index < count; index++) {
		ids[index] = view.getUint32(offset, false)
		offset += 4
		x[index] = view.getFloat64(offset, false)
		offset += 8
		y[index] = view.getFloat64(offset, false)
		offset += 8
		velocityX[index] = view.getFloat64(offset, false)
		offset += 8
		velocityY[index] = view.getFloat64(offset, false)
		offset += 8
		lifeSeconds[index] = view.getFloat64(offset, false)
		offset += 8
	}
	const checkpoint: MovingPointCheckpoint = {
		version: MOVING_POINT_CHECKPOINT_VERSION,
		random: { algorithm: SEEDED_RANDOM_ALGORITHM, state: randomState },
		nextId,
		particles: { count, capacity: count, ids, x, y, velocityX, velocityY, lifeSeconds },
	}
	assertMovingPointCheckpoint(checkpoint)
	return checkpoint
}
