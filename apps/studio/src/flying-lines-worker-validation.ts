import { normalizeParameters } from '../../../src-v2/core/parameters.ts'
import type { ParameterPatch, ParameterValues } from '../../../src-v2/core/parameters.ts'
import { createViewport } from '../../../src-v2/core/viewport.ts'
import type { Viewport } from '../../../src-v2/core/viewport.ts'
import { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import type { FlyingLinesInput } from '../../../src-v2/effects/flying-lines/types.ts'

export interface FlyingLinesWorkerInitializePayload {
	readonly canvas: OffscreenCanvas
	readonly viewport: Viewport
	readonly parameters: ParameterValues<typeof flyingLinesParameters>
	readonly seed: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
	if (!isRecord(value)) throw new TypeError(`${label} must be an object.`)
	return value
}

const requireFinite = (value: unknown, label: string): number => {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new TypeError(`${label} must be a finite number.`)
	}
	return value
}

const requireNonNegativeInteger = (value: unknown, label: string): number => {
	const number = requireFinite(value, label)
	if (!Number.isInteger(number) || number < 0) throw new RangeError(`${label} must be a non-negative integer.`)
	return number
}

const requireNonNegative = (value: unknown, label: string): number => {
	const number = requireFinite(value, label)
	if (number < 0) throw new RangeError(`${label} must be non-negative.`)
	return number
}

export const parseFlyingLinesWorkerViewport = (value: unknown): Viewport => {
	const record = requireRecord(value, 'Worker viewport')
	const viewport = createViewport({
		cssWidth: requireFinite(record.cssWidth, 'Worker viewport cssWidth'),
		cssHeight: requireFinite(record.cssHeight, 'Worker viewport cssHeight'),
		devicePixelRatio: requireFinite(record.devicePixelRatio, 'Worker viewport devicePixelRatio'),
	})
	if (record.backingWidth !== viewport.backingWidth || record.backingHeight !== viewport.backingHeight) {
		throw new RangeError('Worker viewport backing dimensions do not match its CSS dimensions and pixel ratio.')
	}
	return viewport
}

export const parseFlyingLinesWorkerParameters = (
	value: unknown,
): ParameterValues<typeof flyingLinesParameters> => {
	const normalized = normalizeParameters(flyingLinesParameters, value)
	if (!normalized.ok) throw new TypeError(normalized.issues[0]?.message ?? 'Worker parameters are invalid.')
	return normalized.value
}

export const parseFlyingLinesWorkerParameterPatch = (
	value: unknown,
): ParameterPatch<typeof flyingLinesParameters> => {
	const record = requireRecord(value, 'Worker parameter patch')
	const normalized = parseFlyingLinesWorkerParameters(record)
	return Object.fromEntries(Object.keys(record).map((parameterId) => [
		parameterId,
		normalized[parameterId as keyof typeof flyingLinesParameters],
	])) as ParameterPatch<typeof flyingLinesParameters>
}

export const parseFlyingLinesWorkerInput = (value: unknown): FlyingLinesInput => {
	const input = requireRecord(value, 'Worker input')
	if (typeof input.type !== 'string') throw new TypeError('Worker input type must be a string.')

	switch (input.type) {
		case 'add-point':
			return {
				type: input.type,
				x: requireFinite(input.x, 'add-point x'),
				y: requireFinite(input.y, 'add-point y'),
			}
		case 'remove-nearest':
			return {
				type: input.type,
				x: requireFinite(input.x, 'remove-nearest x'),
				y: requireFinite(input.y, 'remove-nearest y'),
				maxDistance: requireNonNegative(input.maxDistance, 'remove-nearest maxDistance'),
			}
		case 'move-point':
			return {
				type: input.type,
				id: requireNonNegativeInteger(input.id, 'move-point id'),
				x: requireFinite(input.x, 'move-point x'),
				y: requireFinite(input.y, 'move-point y'),
			}
		case 'move-nearest':
			return {
				type: input.type,
				fromX: requireFinite(input.fromX, 'move-nearest fromX'),
				fromY: requireFinite(input.fromY, 'move-nearest fromY'),
				x: requireFinite(input.x, 'move-nearest x'),
				y: requireFinite(input.y, 'move-nearest y'),
				maxDistance: requireNonNegative(input.maxDistance, 'move-nearest maxDistance'),
			}
		default:
			throw new TypeError(`Worker input type '${input.type}' is unsupported.`)
	}
}

export const parseFlyingLinesWorkerInitializePayload = (
	value: unknown,
): FlyingLinesWorkerInitializePayload => {
	const payload = requireRecord(value, 'Worker initialize payload')
	if (!isRecord(payload.canvas) || typeof payload.canvas.getContext !== 'function') {
		throw new TypeError('Worker initialize canvas must expose getContext().')
	}
	if (typeof payload.seed !== 'string' || payload.seed.length === 0) {
		throw new TypeError('Worker initialize seed must be a non-empty string.')
	}
	return {
		canvas: payload.canvas as unknown as OffscreenCanvas,
		viewport: parseFlyingLinesWorkerViewport(payload.viewport),
		parameters: parseFlyingLinesWorkerParameters(payload.parameters),
		seed: payload.seed,
	}
}
