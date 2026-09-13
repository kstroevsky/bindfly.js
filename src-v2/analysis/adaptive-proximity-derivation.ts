import type { Derivation, PointBuffer2D } from '../core/index.ts'

import { createProximityGraphWorkspace } from './proximity-graph.ts'
import type { BufferedProximityGraphResult } from './proximity-graph.ts'
import { createUniformGridProximityGraphWorkspace, shouldUseUniformGrid } from './uniform-grid-proximity-graph.ts'

export interface ProximityDerivationInput {
	readonly points: PointBuffer2D
	readonly connectionRadius: number
}

export interface AdaptiveProximityDerivation extends Derivation<ProximityDerivationInput, BufferedProximityGraphResult> {
	readonly backend: 'brute' | 'grid'
}

export const createAdaptiveProximityDerivation = (maximumPointCount: number): AdaptiveProximityDerivation => {
	const brute = createProximityGraphWorkspace(maximumPointCount)
	const grid = createUniformGridProximityGraphWorkspace(maximumPointCount)
	let active = brute
	let backend: 'brute' | 'grid' = 'brute'
	let disposed = false

	return {
		get result() { return active.result },
		get backend() { return backend },
		update: ({ points, connectionRadius }) => {
			if (disposed) throw new Error('Cannot update a disposed proximity derivation.')
			const useGrid = shouldUseUniformGrid(points, connectionRadius)
			active = useGrid ? grid : brute
			backend = useGrid ? 'grid' : 'brute'
			active.analyze(points, connectionRadius)
			return active.result
		},
		dispose: () => { disposed = true },
	}
}
