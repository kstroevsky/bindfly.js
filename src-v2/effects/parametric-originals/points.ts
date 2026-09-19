import type { Derivation } from '../../core/index.ts'
import { evaluateFormulaTransformComparison2D } from '../../formula/index.ts'

import type { ParametricPointBuffer, ParametricPointDerivationInput } from './types.ts'

export const createParametricPointDerivation = (
	maximumPointCount: number,
): Derivation<ParametricPointDerivationInput, ParametricPointBuffer> => {
	if (!Number.isInteger(maximumPointCount) || maximumPointCount <= 0) {
		throw new RangeError('maximumPointCount must be a positive integer.')
	}
	const result: ParametricPointBuffer = {
		count: 0,
		capacity: maximumPointCount,
		ids: new Uint32Array(maximumPointCount),
		x: new Float64Array(maximumPointCount),
		y: new Float64Array(maximumPointCount),
		invalidFormulaPointCount: 0,
	}
	let disposed = false

	return {
		result,
		update: ({ state, kind, viewportWidth, viewportHeight, weight, formulaA, formulaB, formulaMorph }) => {
			if (disposed) throw new Error('Cannot update disposed parametric points.')
			if (state.phases.count > maximumPointCount) {
				throw new RangeError(`Point count ${state.phases.count} exceeds derivation maximum ${maximumPointCount}.`)
			}
			const radius = Math.min(viewportWidth, viewportHeight) / 2
			const particleSpacing = 2 * Math.PI / state.phases.count
			const preAngle = Math.PI / (2 * state.phases.count)
			result.count = 0
			result.invalidFormulaPointCount = 0
			for (let index = 0; index < state.phases.count; index++) {
				const angle = kind === 'pulse'
					? particleSpacing * index + Math.floor(index / state.phases.count) * Math.PI / 2
					: particleSpacing * index + index * preAngle
				const distance = radius * (angle / (2 * Math.PI)) * 2
				const evaluated = evaluateFormulaTransformComparison2D({
					a: formulaA,
					b: formulaB,
					morph: formulaMorph,
				}, {
					a: state.phases.values[index] ?? state.accumulator,
					angle,
					distance,
					positionX: state.centerX,
					positionY: state.centerY,
					weight,
				})
				if (!evaluated.ok) {
					result.invalidFormulaPointCount += 1
					continue
				}
				const target = result.count++
				result.ids[target] = index
				result.x[target] = evaluated.value.morphed.x
				result.y[target] = evaluated.value.morphed.y
			}
			return result
		},
		dispose: () => { disposed = true; result.count = 0; result.invalidFormulaPointCount = 0 },
	}
}
