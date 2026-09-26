import { createPhaseSpaceTransform } from '../../core/index.ts'
import type { Result, Viewport } from '../../core/index.ts'
import type { FormulaIssue } from '../../formula/index.ts'

import type { ScalarFieldSampleGrid } from './types.ts'

export const MAX_SCALAR_FIELD_GRID_AXIS = 384

export type ScalarFieldEvaluator = (x: number, y: number) => Result<number, FormulaIssue>

export const sampleScalarField = (input: {
	readonly viewport: Viewport
	readonly domainRadius: number
	readonly sampleDensity: number
	readonly evaluate: ScalarFieldEvaluator
}): ScalarFieldSampleGrid => {
	const transform = createPhaseSpaceTransform(input.viewport, input.domainRadius)
	const bounds = transform.visibleBounds
	const aspect = input.viewport.cssWidth / input.viewport.cssHeight
	const shortCells = Math.max(2, Math.round(input.sampleDensity))
	const rows = Math.min(MAX_SCALAR_FIELD_GRID_AXIS, (aspect >= 1 ? shortCells : Math.max(2, Math.round(shortCells / aspect))) + 1)
	const columns = Math.min(MAX_SCALAR_FIELD_GRID_AXIS, (aspect >= 1 ? Math.max(2, Math.round(shortCells * aspect)) : shortCells) + 1)
	const values = new Float64Array(columns * rows)
	values.fill(Number.NaN)
	let validCount = 0
	let invalidCount = 0

	for (let row = 0; row < rows; row++) {
		const y = bounds.maxY - row / (rows - 1) * (bounds.maxY - bounds.minY)
		for (let column = 0; column < columns; column++) {
			const x = bounds.minX + column / (columns - 1) * (bounds.maxX - bounds.minX)
			const evaluated = input.evaluate(x, y)
			const index = row * columns + column
			if (evaluated.ok) {
				values[index] = evaluated.value
				validCount++
			} else invalidCount++
		}
	}

	return {
		columns,
		rows,
		minX: bounds.minX,
		maxX: bounds.maxX,
		minY: bounds.minY,
		maxY: bounds.maxY,
		values,
		validCount,
		invalidCount,
	}
}
