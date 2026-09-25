import type { PointCloudSnapshot } from './point-cloud-snapshot.ts'
import { measureRipsComplexSize } from './rips-complex.ts'

export const RIPS_PERSISTENCE_ANALYZER_ID = 'rips-persistence-2d'
export const RIPS_PERSISTENCE_ANALYZER_VERSION = '3'

export interface RipsPersistenceBudget {
	readonly maxTriangles: number
	readonly maxSimplices: number
}

export const DEFAULT_RIPS_PERSISTENCE_BUDGET: RipsPersistenceBudget = Object.freeze({
	maxTriangles: 50_000,
	maxSimplices: 200_000,
})

export interface PersistenceInterval {
	readonly birth: number
	readonly death: number | null
}

export interface PersistenceBackendMetadata {
	readonly id: string
	readonly version: string
	readonly sourceCommit: string
	readonly license: string
	readonly numericSemantics: string
}

export interface RipsPersistenceResult {
	readonly status: 'computed' | 'budget-exceeded'
	readonly epsilonMax: number
	readonly metric: 'euclidean'
	readonly pointCount: number
	readonly edgeCount: number
	readonly triangleCount: number
	readonly triangleCountExact: boolean
	readonly simplexCount: number
	readonly simplexCountExact: boolean
	readonly h0: readonly PersistenceInterval[]
	readonly h1: readonly PersistenceInterval[]
	readonly warnings: readonly string[]
	readonly backend: PersistenceBackendMetadata
}

export interface PersistenceOptions {
	readonly epsilonMax: number
	readonly maximumHomologyDimension: 1
	readonly coefficientField: 2
	readonly budget: RipsPersistenceBudget
}

export interface PersistentHomologyBackend {
	readonly metadata: PersistenceBackendMetadata
	compute(
		snapshot: PointCloudSnapshot,
		options: PersistenceOptions,
		signal?: AbortSignal,
	): Promise<RipsPersistenceResult>
}

export type PersistentHomologyBackendErrorCode =
	| 'backend-failed'
	| 'cancelled'
	| 'invalid-output'
	| 'resource-limit'

export class PersistentHomologyBackendError extends Error {
	readonly code: PersistentHomologyBackendErrorCode

	constructor(
		code: PersistentHomologyBackendErrorCode,
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options)
		this.name = 'PersistentHomologyBackendError'
		this.code = code
	}
}

export interface RipsPersistencePreflight {
	readonly status: 'ready' | 'budget-exceeded'
	readonly epsilonMax: number
	readonly metric: 'euclidean'
	readonly pointCount: number
	readonly edgeCount: number
	readonly triangleCount: number
	readonly triangleCountExact: boolean
	readonly simplexCount: number
	readonly simplexCountExact: boolean
	readonly warnings: readonly string[]
}

const validateBudget = (budget: RipsPersistenceBudget): void => {
	if (!Number.isInteger(budget.maxTriangles) || budget.maxTriangles < 0) {
		throw new RangeError('Persistence triangle budget must be a non-negative integer.')
	}
	if (!Number.isInteger(budget.maxSimplices) || budget.maxSimplices < 0) {
		throw new RangeError('Persistence simplex budget must be a non-negative integer.')
	}
}

export const preflightRipsPersistence = (
	snapshot: PointCloudSnapshot,
	epsilonMax: number,
	budget: RipsPersistenceBudget = DEFAULT_RIPS_PERSISTENCE_BUDGET,
): RipsPersistencePreflight => {
	if (!Number.isFinite(epsilonMax) || epsilonMax <= 0) {
		throw new RangeError('Persistence epsilonMax must be a positive finite number.')
	}
	validateBudget(budget)

	const complex = measureRipsComplexSize(snapshot, epsilonMax, budget.maxTriangles + 1)
	const simplexCount = complex.pointCount + complex.edgeCount + complex.triangleCount
	const simplexCountExact = complex.triangleCountExact
	if (!complex.triangleCountExact || complex.triangleCount > budget.maxTriangles) {
		return {
			status: 'budget-exceeded',
			epsilonMax,
			metric: 'euclidean',
			pointCount: complex.pointCount,
			edgeCount: complex.edgeCount,
			triangleCount: complex.triangleCount,
			triangleCountExact: complex.triangleCountExact,
			simplexCount,
			simplexCountExact,
			warnings: [`Persistent homology was not computed: more than ${budget.maxTriangles} triangles exceed the analysis budget.`],
		}
	}
	if (simplexCount > budget.maxSimplices) {
		return {
			status: 'budget-exceeded',
			epsilonMax,
			metric: 'euclidean',
			pointCount: complex.pointCount,
			edgeCount: complex.edgeCount,
			triangleCount: complex.triangleCount,
			triangleCountExact: true,
			simplexCount,
			simplexCountExact: true,
			warnings: [`Persistent homology was not computed: ${simplexCount} simplices exceed the budget of ${budget.maxSimplices}.`],
		}
	}
	return {
		status: 'ready',
		epsilonMax,
		metric: 'euclidean',
		pointCount: complex.pointCount,
		edgeCount: complex.edgeCount,
		triangleCount: complex.triangleCount,
		triangleCountExact: true,
		simplexCount,
		simplexCountExact: true,
		warnings: [],
	}
}

export const createBudgetExceededPersistenceResult = (
	preflight: RipsPersistencePreflight,
	backend: PersistenceBackendMetadata,
): RipsPersistenceResult => {
	if (preflight.status !== 'budget-exceeded') {
		throw new Error('A budget-exceeded persistence result requires a refused preflight.')
	}
	return {
		status: 'budget-exceeded',
		epsilonMax: preflight.epsilonMax,
		metric: preflight.metric,
		pointCount: preflight.pointCount,
		edgeCount: preflight.edgeCount,
		triangleCount: preflight.triangleCount,
		triangleCountExact: preflight.triangleCountExact,
		simplexCount: preflight.simplexCount,
		simplexCountExact: preflight.simplexCountExact,
		h0: [],
		h1: [],
		warnings: preflight.warnings,
		backend,
	}
}

export const countPersistenceIntervalsAt = (
	intervals: readonly PersistenceInterval[],
	epsilon: number,
): number => {
	if (!Number.isFinite(epsilon) || epsilon < 0) {
		throw new RangeError('Persistence epsilon must be finite and non-negative.')
	}
	let count = 0
	for (const interval of intervals) {
		if (interval.birth <= epsilon && (interval.death === null || epsilon < interval.death)) count++
	}
	return count
}
