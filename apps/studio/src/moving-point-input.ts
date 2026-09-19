import type { MovingPointInput } from '../../../src-v2/effects/moving-points/types.ts'

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
			if (!Number.isInteger(id)) throw new RangeError('move-point id must be an integer.')
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
