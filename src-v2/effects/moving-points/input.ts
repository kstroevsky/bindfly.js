import type { MovingPointInput } from './types.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const finite = (value: unknown, label: string): number => {
	if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`)
	return value
}

const nonNegative = (value: unknown, label: string): number => {
	const number = finite(value, label)
	if (number < 0) throw new RangeError(`${label} must be non-negative.`)
	return number
}

export const parseMovingPointInput = (value: unknown): MovingPointInput => {
	if (!isRecord(value) || typeof value.type !== 'string') throw new TypeError('Point input must be a typed object.')
	switch (value.type) {
		case 'add-point':
			return { type: value.type, x: finite(value.x, 'add-point x'), y: finite(value.y, 'add-point y') }
		case 'remove-nearest':
			return {
				type: value.type,
				x: finite(value.x, 'remove-nearest x'),
				y: finite(value.y, 'remove-nearest y'),
				maxDistance: nonNegative(value.maxDistance, 'remove-nearest maxDistance'),
			}
		case 'move-point': {
			const id = nonNegative(value.id, 'move-point id')
			if (!Number.isInteger(id) || id > 0xffff_ffff) throw new RangeError('move-point id must be an unsigned 32-bit integer.')
			return { type: value.type, id, x: finite(value.x, 'move-point x'), y: finite(value.y, 'move-point y') }
		}
		case 'move-nearest':
			return {
				type: value.type,
				fromX: finite(value.fromX, 'move-nearest fromX'),
				fromY: finite(value.fromY, 'move-nearest fromY'),
				x: finite(value.x, 'move-nearest x'),
				y: finite(value.y, 'move-nearest y'),
				maxDistance: nonNegative(value.maxDistance, 'move-nearest maxDistance'),
			}
		default:
			throw new TypeError(`Point input type '${value.type}' is unsupported.`)
	}
}

export const encodeMovingPointInputV1 = (input: MovingPointInput): Uint8Array => {
	const parsed = parseMovingPointInput(input)
	const byteLength = parsed.type === 'add-point' ? 17
		: parsed.type === 'remove-nearest' ? 25
			: parsed.type === 'move-point' ? 21
				: 41
	const bytes = new Uint8Array(byteLength)
	const view = new DataView(bytes.buffer)
	let offset = 1
	const writeFloat64 = (value: number): void => {
		view.setFloat64(offset, value, false)
		offset += 8
	}

	switch (parsed.type) {
		case 'add-point':
			bytes[0] = 1
			writeFloat64(parsed.x)
			writeFloat64(parsed.y)
			break
		case 'remove-nearest':
			bytes[0] = 2
			writeFloat64(parsed.x)
			writeFloat64(parsed.y)
			writeFloat64(parsed.maxDistance)
			break
		case 'move-point':
			bytes[0] = 3
			view.setUint32(offset, parsed.id, false)
			offset += 4
			writeFloat64(parsed.x)
			writeFloat64(parsed.y)
			break
		case 'move-nearest':
			bytes[0] = 4
			writeFloat64(parsed.fromX)
			writeFloat64(parsed.fromY)
			writeFloat64(parsed.x)
			writeFloat64(parsed.y)
			writeFloat64(parsed.maxDistance)
			break
	}
	return bytes
}
