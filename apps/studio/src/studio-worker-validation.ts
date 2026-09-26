import { createViewport } from '../../../src-v2/core/viewport.ts'
import type { Viewport } from '../../../src-v2/core/viewport.ts'
import { isRuntimeFormulaView } from '../../../src-v2/runtime/protocol.ts'
import type { RuntimeFormulaView } from '../../../src-v2/runtime/protocol.ts'

export interface StudioWorkerInitializePayload {
	readonly canvas: OffscreenCanvas
	readonly experimentId: string
	readonly parameters: unknown
	readonly formulaView: RuntimeFormulaView
	readonly seed: string
	readonly viewport: Viewport
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const finite = (value: unknown, label: string): number => {
	if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`)
	return value
}

export const parseStudioWorkerViewport = (value: unknown): Viewport => {
	if (!isRecord(value)) throw new TypeError('Worker viewport must be an object.')
	const viewport = createViewport({
		cssWidth: finite(value.cssWidth, 'Worker viewport cssWidth'),
		cssHeight: finite(value.cssHeight, 'Worker viewport cssHeight'),
		devicePixelRatio: finite(value.devicePixelRatio, 'Worker viewport devicePixelRatio'),
	})
	if (value.backingWidth !== viewport.backingWidth || value.backingHeight !== viewport.backingHeight) {
		throw new RangeError('Worker viewport backing dimensions do not match its CSS dimensions and pixel ratio.')
	}
	return viewport
}

export const parseStudioWorkerInitializePayload = (value: unknown): StudioWorkerInitializePayload => {
	if (!isRecord(value)) throw new TypeError('Worker initialize payload must be an object.')
	if (!isRecord(value.canvas) || typeof value.canvas.getContext !== 'function') {
		throw new TypeError('Worker initialize canvas must expose getContext().')
	}
	if (typeof value.experimentId !== 'string' || value.experimentId.length === 0) {
		throw new TypeError('Worker initialize experimentId must be a non-empty string.')
	}
	if (typeof value.seed !== 'string' || value.seed.length === 0) {
		throw new TypeError('Worker initialize seed must be a non-empty string.')
	}
	if (!isRuntimeFormulaView(value.formulaView)) throw new TypeError('Worker initialize formulaView is invalid.')
	return {
		canvas: value.canvas as unknown as OffscreenCanvas,
		experimentId: value.experimentId,
		parameters: value.parameters,
		formulaView: value.formulaView,
		seed: value.seed,
		viewport: parseStudioWorkerViewport(value.viewport),
	}
}
