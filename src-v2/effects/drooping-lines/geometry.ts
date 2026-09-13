import type { Derivation } from '../../core/index.ts'

import type { DroopingGeometryInput, DroopingLineBuffer } from './types.ts'

export const createDroopingGeometry = (
	maximumPointCount: number,
): Derivation<DroopingGeometryInput, DroopingLineBuffer> => {
	if (!Number.isInteger(maximumPointCount) || maximumPointCount <= 0) {
		throw new RangeError('maximumPointCount must be a positive integer.')
	}
	const capacity = maximumPointCount * maximumPointCount
	const result: DroopingLineBuffer = {
		count: 0,
		capacity,
		sourceParticleIndices: new Uint32Array(capacity),
		sourceX: new Float64Array(capacity),
		sourceY: new Float64Array(capacity),
		targetX: new Float64Array(capacity),
		targetY: new Float64Array(capacity),
		distances: new Float64Array(capacity),
		opacities: new Float64Array(capacity),
	}
	let disposed = false

	return {
		result,
		update: ({ particles, connectionRadius, deformation }) => {
			if (disposed) throw new Error('Cannot update disposed Drooping Lines geometry.')
			if (!Number.isFinite(connectionRadius) || connectionRadius <= 0) {
				throw new RangeError('Drooping Lines connection radius must be positive and finite.')
			}
			if (particles.count > maximumPointCount) {
				throw new RangeError(`Point count ${particles.count} exceeds geometry maximum ${maximumPointCount}.`)
			}
			result.count = 0
			const radiusSquared = connectionRadius * connectionRadius
			for (let sourceIndex = 0; sourceIndex < particles.count; sourceIndex++) {
				const particleX = particles.x[sourceIndex] ?? 0
				const particleY = particles.y[sourceIndex] ?? 0
				const sourceX = deformation === 'tan-x' ? Math.tan(particleX) : particleX
				const sourceY = deformation === 'atan-y' ? Math.atan(particleY) : particleY
				for (let targetIndex = 0; targetIndex < particles.count; targetIndex++) {
					const targetX = particles.x[targetIndex] ?? 0
					const targetY = particles.y[targetIndex] ?? 0
					const deltaX = targetX - sourceX
					const deltaY = targetY - sourceY
					const distanceSquared = deltaX * deltaX + deltaY * deltaY
					if (distanceSquared >= radiusSquared) continue
					const distance = Math.sqrt(distanceSquared)
					const lineIndex = result.count++
					result.sourceParticleIndices[lineIndex] = sourceIndex
					result.sourceX[lineIndex] = sourceX
					result.sourceY[lineIndex] = sourceY
					result.targetX[lineIndex] = targetX
					result.targetY[lineIndex] = targetY
					result.distances[lineIndex] = distance
					result.opacities[lineIndex] = 1 - distance / connectionRadius
				}
			}
			return result
		},
		dispose: () => { disposed = true; result.count = 0 },
	}
}
