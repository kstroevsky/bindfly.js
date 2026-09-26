import type { Viewport } from './viewport.ts'

export interface PhaseSpacePoint {
	readonly x: number
	readonly y: number
}

export interface PhaseSpaceBounds {
	readonly minX: number
	readonly maxX: number
	readonly minY: number
	readonly maxY: number
}

export interface PhaseSpaceTransform {
	readonly pixelsPerUnit: number
	readonly visibleBounds: PhaseSpaceBounds
	toCanvas(point: PhaseSpacePoint): PhaseSpacePoint
	toMathematical(point: PhaseSpacePoint): PhaseSpacePoint
}

export const createPhaseSpaceTransform = (
	viewport: Pick<Viewport, 'cssWidth' | 'cssHeight'>,
	domainRadius: number,
): PhaseSpaceTransform => {
	if (!Number.isFinite(domainRadius) || domainRadius <= 0) {
		throw new RangeError('Phase-space domain radius must be positive and finite.')
	}
	const pixelsPerUnit = Math.min(viewport.cssWidth, viewport.cssHeight) / (2 * domainRadius)
	const centerX = viewport.cssWidth / 2
	const centerY = viewport.cssHeight / 2
	const halfWidth = centerX / pixelsPerUnit
	const halfHeight = centerY / pixelsPerUnit

	return Object.freeze({
		pixelsPerUnit,
		visibleBounds: Object.freeze({
			minX: -halfWidth,
			maxX: halfWidth,
			minY: -halfHeight,
			maxY: halfHeight,
		}),
		toCanvas: ({ x, y }: PhaseSpacePoint) => ({
			x: centerX + x * pixelsPerUnit,
			y: centerY - y * pixelsPerUnit,
		}),
		toMathematical: ({ x, y }: PhaseSpacePoint) => ({
			x: (x - centerX) / pixelsPerUnit,
			y: (centerY - y) / pixelsPerUnit,
		}),
	})
}
