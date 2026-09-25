import type { PointBuffer2D } from '../core/index.ts'

export type PointCloudSnapshotSource = 'morph' | 'formula-a' | 'formula-b'

export interface PointCloudSnapshot {
	readonly snapshotId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly simulationStep: number
	readonly source: PointCloudSnapshotSource
	readonly metric: 'euclidean'
	readonly coordinateUnits: 'css-px'
	readonly ids: Uint32Array
	readonly x: Float64Array
	readonly y: Float64Array
	readonly formulaConfigurationHash: string
}

export interface CreatePointCloudSnapshotOptions {
	readonly snapshotId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly simulationStep: number
	readonly source: PointCloudSnapshotSource
	readonly points: PointBuffer2D
	readonly formulaConfigurationHash: string
}

export const createPointCloudSnapshot = ({
	snapshotId,
	experimentId,
	stateVersion,
	simulationStep,
	source,
	points,
	formulaConfigurationHash,
}: CreatePointCloudSnapshotOptions): PointCloudSnapshot => {
	if (!snapshotId || !experimentId || !formulaConfigurationHash) throw new Error('Point-cloud snapshot identity is required.')
	if (!Number.isInteger(stateVersion) || stateVersion < 0) throw new RangeError('Point-cloud state version must be a non-negative integer.')
	if (!Number.isInteger(simulationStep) || simulationStep < 0) throw new RangeError('Point-cloud simulation step must be a non-negative integer.')
	const ids = new Uint32Array(points.count)
	const x = new Float64Array(points.count)
	const y = new Float64Array(points.count)
	for (let index = 0; index < points.count; index++) {
		const pointX = points.x[index]
		const pointY = points.y[index]
		if (pointX === undefined || pointY === undefined || !Number.isFinite(pointX) || !Number.isFinite(pointY)) {
			throw new Error(`Point ${index} is not finite.`)
		}
		ids[index] = points.ids[index] ?? index
		x[index] = pointX
		y[index] = pointY
	}
	return Object.freeze({
		snapshotId,
		experimentId,
		stateVersion,
		simulationStep,
		source,
		metric: 'euclidean' as const,
		coordinateUnits: 'css-px' as const,
		ids,
		x,
		y,
		formulaConfigurationHash,
	})
}

export const isPointCloudSnapshot = (value: unknown): value is PointCloudSnapshot => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
	const snapshot = value as Partial<PointCloudSnapshot>
	return typeof snapshot.snapshotId === 'string' && snapshot.snapshotId.length > 0
		&& typeof snapshot.experimentId === 'string' && snapshot.experimentId.length > 0
		&& Number.isInteger(snapshot.stateVersion) && (snapshot.stateVersion ?? -1) >= 0
		&& Number.isInteger(snapshot.simulationStep) && (snapshot.simulationStep ?? -1) >= 0
		&& ['morph', 'formula-a', 'formula-b'].includes(snapshot.source ?? '')
		&& snapshot.metric === 'euclidean'
		&& snapshot.coordinateUnits === 'css-px'
		&& snapshot.ids instanceof Uint32Array
		&& snapshot.x instanceof Float64Array
		&& snapshot.y instanceof Float64Array
		&& snapshot.ids.length === snapshot.x.length && snapshot.x.length === snapshot.y.length
		&& typeof snapshot.formulaConfigurationHash === 'string' && snapshot.formulaConfigurationHash.length > 0
}
