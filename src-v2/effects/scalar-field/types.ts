import type { ParameterValues } from '../../core/index.ts'

import type { scalarFieldParameters } from './parameters.ts'

export type ScalarFieldParameters = ParameterValues<typeof scalarFieldParameters>

export interface ScalarFieldState {
	readonly staticField: true
}

export type ScalarFieldInput = never

export interface ScalarFieldSampleGrid {
	readonly columns: number
	readonly rows: number
	readonly minX: number
	readonly maxX: number
	readonly minY: number
	readonly maxY: number
	readonly values: Float64Array
	readonly validCount: number
	readonly invalidCount: number
}
