export interface Viewport {
	readonly cssWidth: number
	readonly cssHeight: number
	readonly devicePixelRatio: number
	readonly backingWidth: number
	readonly backingHeight: number
}

export interface ViewportInput {
	readonly cssWidth: number
	readonly cssHeight: number
	readonly devicePixelRatio: number
}

const assertPositiveFinite = (name: string, value: number) => {
	if (!Number.isFinite(value) || value <= 0) {
		throw new RangeError(`Viewport ${name} must be a positive finite number.`)
	}
}

export const createViewport = ({
	cssWidth,
	cssHeight,
	devicePixelRatio,
}: ViewportInput): Viewport => {
	assertPositiveFinite('cssWidth', cssWidth)
	assertPositiveFinite('cssHeight', cssHeight)
	assertPositiveFinite('devicePixelRatio', devicePixelRatio)

	return {
		cssWidth,
		cssHeight,
		devicePixelRatio,
		backingWidth: Math.round(cssWidth * devicePixelRatio),
		backingHeight: Math.round(cssHeight * devicePixelRatio),
	}
}
