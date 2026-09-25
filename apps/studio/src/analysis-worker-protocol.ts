import { isPointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import type { PointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import type { RipsComplexResult } from '../../../src-v2/analysis/rips-complex.ts'
import type { RipsPersistenceResult } from '../../../src-v2/analysis/rips-persistence.ts'

export interface RipsAnalysisWorkerRequest {
	readonly type: 'analyze-rips'
	readonly requestId: string
	readonly snapshot: PointCloudSnapshot
	readonly epsilon: number
}

export interface RipsPersistenceWorkerRequest {
	readonly type: 'analyze-rips-persistence'
	readonly requestId: string
	readonly snapshot: PointCloudSnapshot
	readonly epsilonMax: number
}

export type AnalysisWorkerRequest = RipsAnalysisWorkerRequest | RipsPersistenceWorkerRequest

export type AnalysisWorkerResponse =
	| { readonly type: 'rips-result'; readonly requestId: string; readonly result: RipsComplexResult }
	| { readonly type: 'persistence-result'; readonly requestId: string; readonly result: RipsPersistenceResult }
	| { readonly type: 'analysis-error'; readonly requestId: string; readonly message: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

export const isAnalysisWorkerRequest = (value: unknown): value is AnalysisWorkerRequest => {
	if (!isRecord(value)
		|| typeof value.requestId !== 'string' || value.requestId.length === 0
		|| !isPointCloudSnapshot(value.snapshot)) return false
	if (value.type === 'analyze-rips') {
		return typeof value.epsilon === 'number' && Number.isFinite(value.epsilon) && value.epsilon > 0
	}
	if (value.type === 'analyze-rips-persistence') {
		return typeof value.epsilonMax === 'number' && Number.isFinite(value.epsilonMax) && value.epsilonMax > 0
	}
	return false
}

const isPersistenceInterval = (value: unknown): boolean =>
	isRecord(value)
	&& typeof value.birth === 'number' && Number.isFinite(value.birth) && value.birth >= 0
	&& (value.death === null || (typeof value.death === 'number' && Number.isFinite(value.death) && value.death >= value.birth))

const isRipsPersistenceResult = (value: unknown): value is RipsPersistenceResult =>
	isRecord(value)
	&& (value.status === 'computed' || value.status === 'budget-exceeded')
	&& typeof value.epsilonMax === 'number' && Number.isFinite(value.epsilonMax) && value.epsilonMax > 0
	&& value.metric === 'euclidean'
	&& typeof value.pointCount === 'number'
	&& typeof value.edgeCount === 'number'
	&& typeof value.triangleCount === 'number'
	&& typeof value.triangleCountExact === 'boolean'
	&& typeof value.simplexCount === 'number'
	&& typeof value.simplexCountExact === 'boolean'
	&& Array.isArray(value.h0) && value.h0.every(isPersistenceInterval)
	&& Array.isArray(value.h1) && value.h1.every(isPersistenceInterval)
	&& Array.isArray(value.warnings) && value.warnings.every((warning) => typeof warning === 'string')
	&& isRecord(value.backend)
	&& typeof value.backend.id === 'string'
	&& typeof value.backend.version === 'string'
	&& typeof value.backend.sourceCommit === 'string'
	&& typeof value.backend.license === 'string'
	&& typeof value.backend.numericSemantics === 'string'

export const isAnalysisWorkerResponse = (value: unknown): value is AnalysisWorkerResponse => {
	if (!isRecord(value) || typeof value.requestId !== 'string' || value.requestId.length === 0) return false
	if (value.type === 'analysis-error') return typeof value.message === 'string'
	if (value.type === 'persistence-result') return isRipsPersistenceResult(value.result)
	if (value.type !== 'rips-result' || !isRecord(value.result)) return false
	const result = value.result
	return typeof result.pointCount === 'number'
		&& typeof result.edgeCount === 'number'
		&& typeof result.beta0 === 'number'
		&& typeof result.meanDegree === 'number'
		&& typeof result.isolatedPointCount === 'number'
		&& typeof result.graphCycleRank === 'number'
		&& typeof result.triangleCount === 'number'
		&& (result.beta1 === undefined || typeof result.beta1 === 'number')
		&& (result.beta1Status === 'computed' || result.beta1Status === 'budget-exceeded')
		&& typeof result.epsilon === 'number'
		&& result.metric === 'euclidean'
		&& result.edgeSourceIndices instanceof Uint32Array
		&& result.edgeTargetIndices instanceof Uint32Array
		&& result.edgeBirths instanceof Float64Array
		&& isRecord(result.triangles)
		&& result.triangles.a instanceof Uint32Array
		&& result.triangles.b instanceof Uint32Array
		&& result.triangles.c instanceof Uint32Array
		&& result.triangles.births instanceof Float64Array
}
