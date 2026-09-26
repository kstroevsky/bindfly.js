import type { MovingPointInput } from '../../../src-v2/effects/moving-points/types.ts'
import type { TypedStudioInteractionController } from './studio-experiment-plugin.ts'

export const createMovingPointInteractionController = (): TypedStudioInteractionController<MovingPointInput> => {
	let previous: { readonly x: number; readonly y: number } | undefined
	let moved = false
	return {
		handle: (event): readonly MovingPointInput[] => {
			switch (event.phase) {
				case 'down':
					if (event.shiftKey) return [{ type: 'remove-nearest', x: event.x, y: event.y, maxDistance: 18 }]
					previous = { x: event.x, y: event.y }
					moved = false
					return []
				case 'move': {
					if (!previous || event.buttons === 0) return []
					if (Math.hypot(event.x - previous.x, event.y - previous.y) >= 2) moved = true
					const input: MovingPointInput = {
						type: 'move-nearest',
						fromX: previous.x,
						fromY: previous.y,
						x: event.x,
						y: event.y,
						maxDistance: 14,
					}
					previous = { x: event.x, y: event.y }
					return [input]
				}
				case 'up': {
					const shouldAdd = previous !== undefined && !moved
					previous = undefined
					return shouldAdd ? [{ type: 'add-point', x: event.x, y: event.y }] : []
				}
				case 'cancel':
					previous = undefined
					return []
			}
		},
	}
}
