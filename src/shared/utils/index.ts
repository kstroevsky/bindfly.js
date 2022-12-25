import { MutableRefObject } from 'react'
import { IDataContext } from '../../components/Context'

import { TOUCH_EXPIRATION } from '../constants'
import {
	IAnimationWithParticles,
	IProperty,
	ISingleParticle,
	IVectorsForIntersect,
	TPropertiesValues,
	WorkerClickData
} from '../types'

export const getPosition = (
	position: number,
	size: number,
	velocity: number,
	margin: number
): number =>
	velocity *
	((position + velocity > size - margin && velocity > 0) ||
		(position + velocity < margin && velocity < margin)
		? -1
		: 1)

export const canvasReload = (
	toggle: IDataContext['keyToggle'],
	webWorker: IDataContext['webWorker'],
	canvasRef: MutableRefObject<HTMLCanvasElement | null>
): void => {
	if (webWorker) {
		webWorker?.current?.postMessage({ msg: 'stop' })
		webWorker?.current?.terminate()
		webWorker.current = null
	}
	if (canvasRef) canvasRef.current = null
	if (toggle) toggle.current = !toggle?.current
}

export const isLayoutActive = (start: number, end: number): boolean =>
	!!end && end - start >= TOUCH_EXPIRATION

export const getMediaMatches = (query: string): boolean =>
	typeof window !== 'undefined' && window.matchMedia(query).matches

export const RGBAToHexA = (rgbaString: string, forceRemoveAlpha = false): string =>
	'#' +
	rgbaString
		.replace(/^rgba?\(|\s+|\)$/g, '')
		.split(',')
		.slice(0, 3 + +forceRemoveAlpha)
		.map((string, index) => {
			const number = parseFloat(string)

			return (index === 3 ? Math.round(number * 255) : number).toString(16)
		})
		.reduce((acc, item) => acc + (item.length === 1 ? `0${item}` : item), '')

export const RGBAToNegative = (rgbaString: string): string =>
	`${rgbaString.match(/^rgba?/g)![0]}(${rgbaString.match(/[0-9]+/g)!.map((x, i) => i < 3 ? 255 - parseInt(x) : x).join(',')})`

export const parametersToString = (
	value: TPropertiesValues | TPropertiesValues[]
): string => {
	switch (true) {
		case Array.isArray(value):
			return (value as TPropertiesValues[]).map(parametersToString).join(', ')
		case /rgb/g.test(value as string):
			return RGBAToHexA(value as string)
		case typeof value === 'boolean':
		default:
			return value?.toString() || ''
	}
}

export const isVectorsIntersected = ({ a, b, c, d, p, q, r, s }: IVectorsForIntersect): boolean => {
	const det = (c - a) * (s - q) - (r - p) * (d - b)
	if (det === 0) return false
	else {
		const lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det
		const gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det
		return (lambda > 0 && lambda < 1) && (gamma > 0 && gamma < 1)
	}
}

export const canvasClickHandler = <A extends IAnimationWithParticles<IProperty>>(
	animation: A,
	e: { pos: WorkerClickData },
	offset = 0
) => {
	if (animation.properties.moveByClick) animation.reInit?.(e.pos.x, e.pos.y)
	if (animation.properties.addByClick) {
		animation.particles.push(
			Object.assign(
				{},
				{
					...animation.particles[0],
					life: Math.random() * animation.properties.particleLife * 60,
					x: e.pos.x - offset,
					y: e.pos.y,
					isStart: true,
					start: 0
				}
			)
		)
		if (animation.properties.isStatic) {
			if (!animation.isStarted) {
				animation.isStarted = true
				animation.loop()
			}
		}
		if (animation.properties.isCountStable) {
			animation.particles.shift()
			if (animation.colorOffset) animation.colorOffset += 1
		}
	}

	animation.properties.switchByClick &&
		animation.properties.isMonochrome
		? animation.properties.bgColor = RGBAToNegative(animation.properties.bgColor || 'rgba(255, 255, 255, 1)')
		: animation.particles.push(animation.particles.shift() as ISingleParticle)
}
