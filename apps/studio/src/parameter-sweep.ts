import { RIPS_COMPLEX_ANALYZER_ID, RIPS_COMPLEX_ANALYZER_VERSION } from '../../../src-v2/analysis/rips-complex.ts'
import type { RipsComplexResult } from '../../../src-v2/analysis/rips-complex.ts'
import type { PointCloudSnapshot, PointCloudSnapshotSource } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import type { DeterminismTier } from '../../../src-v2/core/clock.ts'
import type { NumberParameterDefinition, ParameterSchema } from '../../../src-v2/core/parameters.ts'

export const PARAMETER_SWEEP_FORMAT = 'bindfly-parameter-sweep'
export const PARAMETER_SWEEP_VERSION = 2
export const PARAMETER_SWEEP_STATE_FINGERPRINT_ENCODING_VERSION = 1
export const MAX_SWEEP_SAMPLES = 9
export const MAX_DYNAMIC_SWEEP_STEPS = 600

export type ParameterSweepMode = 'frozen-formula' | 'dynamic-simulation'

export interface ParameterSweepRange {
	readonly start: number
	readonly end: number
	readonly step: number
}

export interface ParameterSweepStateFingerprint {
	readonly algorithm: 'sha-256'
	readonly encodingVersion: typeof PARAMETER_SWEEP_STATE_FINGERPRINT_ENCODING_VERSION
	readonly value: string
}

export interface ParameterSweepPlan {
	readonly format: typeof PARAMETER_SWEEP_FORMAT
	readonly version: typeof PARAMETER_SWEEP_VERSION
	readonly mode: ParameterSweepMode
	readonly experimentId: string
	readonly experimentStateVersion: number
	readonly baseExperimentPayload: string
	readonly seed: string
	readonly parameterId: string
	readonly values: readonly number[]
	readonly source: PointCloudSnapshotSource
	readonly epsilon: number
	readonly viewport: { readonly width: number; readonly height: number }
	readonly anchor: {
		readonly kind: 'frozen-simulation'
		readonly simulationSnapshotId: string
		readonly simulationStep: number
		readonly stateFingerprint: ParameterSweepStateFingerprint
	} | {
		readonly kind: 'initial-conditions'
		readonly stepCount: number
		readonly fixedStepSeconds: number
		readonly deterministicTier: DeterminismTier
	}
}

export interface ParameterSweepSample {
	readonly parameterValue: number
	readonly snapshotId: string
	readonly simulationStep: number
	readonly formulaConfigurationHash: string
	readonly pointCount: number
	readonly edgeCount: number
	readonly beta0: number
	readonly beta1?: number
	readonly beta1Status: 'computed' | 'budget-exceeded'
	readonly meanDegree: number
	readonly warnings: readonly string[]
	readonly preview: {
		readonly x: readonly number[]
		readonly y: readonly number[]
	}
}

export interface ParameterSweepResult {
	readonly format: typeof PARAMETER_SWEEP_FORMAT
	readonly version: typeof PARAMETER_SWEEP_VERSION
	readonly plan: ParameterSweepPlan
	readonly analyzer: {
		readonly id: typeof RIPS_COMPLEX_ANALYZER_ID
		readonly version: typeof RIPS_COMPLEX_ANALYZER_VERSION
		readonly metric: 'euclidean'
		readonly coordinateUnits: 'css-px'
		readonly approximation: 'full-point-cloud'
	}
	readonly samples: readonly ParameterSweepSample[]
}

const decimalPlaces = (value: number): number => {
	const source = String(value).toLowerCase()
	const [coefficient, exponentText] = source.split('e')
	const exponent = exponentText ? Number(exponentText) : 0
	const fractionLength = coefficient?.split('.')[1]?.length ?? 0
	return Math.max(0, fractionLength - exponent)
}

const roundForStep = (value: number, step: number): number => {
	const precision = Math.min(12, decimalPlaces(step) + 2)
	return Number(value.toFixed(precision))
}

const assertFinite = (label: string, value: number): void => {
	if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite.`)
}

const SWEEP_STATE_MAGIC = new TextEncoder().encode('bindfly-sweep-state-v1')

const encodeLengthPrefixedText = (value: string): Uint8Array => {
	const encoded = new TextEncoder().encode(value)
	const bytes = new Uint8Array(4 + encoded.byteLength)
	new DataView(bytes.buffer).setUint32(0, encoded.byteLength, false)
	bytes.set(encoded, 4)
	return bytes
}

export const encodeParameterSweepStateFingerprintV1 = (snapshot: PointCloudSnapshot): Uint8Array => {
	const experimentId = encodeLengthPrefixedText(snapshot.experimentId)
	const source = encodeLengthPrefixedText(snapshot.source)
	const formulaHash = encodeLengthPrefixedText(snapshot.formulaConfigurationHash)
	const pointBytes = snapshot.ids.length * (4 + 8 + 8)
	const bytes = new Uint8Array(
		SWEEP_STATE_MAGIC.byteLength + experimentId.byteLength + source.byteLength + formulaHash.byteLength + 20 + pointBytes,
	)
	let offset = 0
	bytes.set(SWEEP_STATE_MAGIC, offset); offset += SWEEP_STATE_MAGIC.byteLength
	bytes.set(experimentId, offset); offset += experimentId.byteLength
	bytes.set(source, offset); offset += source.byteLength
	bytes.set(formulaHash, offset); offset += formulaHash.byteLength
	const view = new DataView(bytes.buffer)
	view.setFloat64(offset, snapshot.stateVersion, false); offset += 8
	view.setFloat64(offset, snapshot.simulationStep, false); offset += 8
	view.setUint32(offset, snapshot.ids.length, false); offset += 4
	for (let index = 0; index < snapshot.ids.length; index++) {
		view.setUint32(offset, snapshot.ids[index] ?? 0, false); offset += 4
		view.setFloat64(offset, snapshot.x[index] ?? 0, false); offset += 8
		view.setFloat64(offset, snapshot.y[index] ?? 0, false); offset += 8
	}
	return bytes
}

export const createParameterSweepStateFingerprint = async (
	snapshot: PointCloudSnapshot,
): Promise<ParameterSweepStateFingerprint> => {
	const digest = await globalThis.crypto.subtle.digest('SHA-256', encodeParameterSweepStateFingerprintV1(snapshot))
	const value = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
	return Object.freeze({
		algorithm: 'sha-256' as const,
		encodingVersion: PARAMETER_SWEEP_STATE_FINGERPRINT_ENCODING_VERSION,
		value,
	})
}

export const getSweepableFormulaParameters = (
	schema: ParameterSchema,
): readonly { readonly id: string; readonly definition: NumberParameterDefinition }[] => Object.entries(schema)
	.filter((entry): entry is [string, NumberParameterDefinition] =>
		entry[1].kind === 'number' && entry[1].semantic === 'formula-parameter')
	.map(([id, definition]) => ({ id, definition }))

export const createSweepValues = (
	definition: NumberParameterDefinition,
	range: ParameterSweepRange,
	maxSamples = MAX_SWEEP_SAMPLES,
): readonly number[] => {
	if (definition.semantic !== 'formula-parameter') throw new Error('Parameter sweeps require a declared formula parameter.')
	assertFinite('Sweep start', range.start)
	assertFinite('Sweep end', range.end)
	assertFinite('Sweep step', range.step)
	if (range.step <= 0) throw new RangeError('Sweep step must be positive.')
	if (range.end < range.start) throw new RangeError('Sweep end must be greater than or equal to sweep start.')
	if (!Number.isInteger(maxSamples) || maxSamples < 1) throw new RangeError('Sweep sample budget must be a positive integer.')
	if (definition.min !== undefined && range.start < definition.min) throw new RangeError(`Sweep start must be at least ${definition.min}.`)
	if (definition.max !== undefined && range.end > definition.max) throw new RangeError(`Sweep end must be at most ${definition.max}.`)
	if (definition.step !== undefined) {
		const base = definition.min ?? 0
		for (const [label, value] of [['start', range.start], ['end', range.end], ['step', range.step]] as const) {
			const units = label === 'step' ? value / definition.step : (value - base) / definition.step
			if (Math.abs(units - Math.round(units)) > 1e-9) {
				throw new RangeError(`Sweep ${label} must align to declared parameter step ${definition.step}.`)
			}
		}
	}
	const values: number[] = []
	for (let value = range.start, index = 0; value <= range.end + range.step * 1e-9; value = range.start + ++index * range.step) {
		values.push(roundForStep(value, range.step))
		if (values.length > maxSamples) throw new RangeError(`Sweep exceeds the ${maxSamples}-sample product budget.`)
	}
	return Object.freeze(values)
}

export const createParameterSweepPlan = (input: Omit<ParameterSweepPlan, 'format' | 'version'>): ParameterSweepPlan => {
	if (!input.experimentId || !input.baseExperimentPayload || !input.seed || !input.parameterId) {
		throw new Error('Sweep experiment, state payload, seed, and parameter identity are required.')
	}
	if (!Number.isInteger(input.experimentStateVersion) || input.experimentStateVersion < 0) {
		throw new RangeError('Sweep experiment state version must be a non-negative integer.')
	}
	if (input.values.length === 0 || input.values.length > MAX_SWEEP_SAMPLES || input.values.some((value) => !Number.isFinite(value))) {
		throw new RangeError(`Sweep must contain between 1 and ${MAX_SWEEP_SAMPLES} finite samples.`)
	}
	assertFinite('Sweep epsilon', input.epsilon)
	if (input.epsilon <= 0) throw new RangeError('Sweep epsilon must be positive.')
	if (!(input.viewport.width > 0) || !(input.viewport.height > 0)) throw new RangeError('Sweep viewport must be positive.')
	if (input.mode === 'frozen-formula' && input.anchor.kind !== 'frozen-simulation'
		|| input.mode === 'dynamic-simulation' && input.anchor.kind !== 'initial-conditions') {
		throw new Error(`Sweep mode '${input.mode}' does not match anchor '${input.anchor.kind}'.`)
	}
	if (input.anchor.kind === 'initial-conditions'
		&& (!Number.isInteger(input.anchor.stepCount) || input.anchor.stepCount < 0 || input.anchor.stepCount > MAX_DYNAMIC_SWEEP_STEPS)) {
		throw new RangeError(`Dynamic sweep step count must be between 0 and ${MAX_DYNAMIC_SWEEP_STEPS}.`)
	}
	if (input.anchor.kind === 'initial-conditions') {
		assertFinite('Dynamic sweep fixed step', input.anchor.fixedStepSeconds)
		if (input.anchor.fixedStepSeconds <= 0) throw new RangeError('Dynamic sweep fixed step must be positive.')
		if (input.anchor.deterministicTier !== 'same-build-cpu') throw new Error('Dynamic sweep determinism tier is unsupported.')
	}
	if (input.anchor.kind === 'frozen-simulation'
		&& (!input.anchor.simulationSnapshotId || !Number.isInteger(input.anchor.simulationStep) || input.anchor.simulationStep < 0)) {
		throw new Error('Frozen sweep requires a named non-negative simulation step.')
	}
	if (input.anchor.kind === 'frozen-simulation'
		&& (input.anchor.stateFingerprint.algorithm !== 'sha-256'
			|| input.anchor.stateFingerprint.encodingVersion !== PARAMETER_SWEEP_STATE_FINGERPRINT_ENCODING_VERSION
			|| !/^[0-9a-f]{64}$/u.test(input.anchor.stateFingerprint.value))) {
		throw new Error('Frozen sweep requires a valid versioned SHA-256 state fingerprint.')
	}
	return Object.freeze({ format: PARAMETER_SWEEP_FORMAT, version: PARAMETER_SWEEP_VERSION, ...input })
}

export const createParameterSweepSample = (
	snapshot: PointCloudSnapshot,
	parameterValue: number,
	result: RipsComplexResult,
): ParameterSweepSample => {
	return Object.freeze({
		parameterValue,
		snapshotId: snapshot.snapshotId,
		simulationStep: snapshot.simulationStep,
		formulaConfigurationHash: snapshot.formulaConfigurationHash,
		pointCount: result.pointCount,
		edgeCount: result.edgeCount,
		beta0: result.beta0,
		...(result.beta1 === undefined ? {} : { beta1: result.beta1 }),
		beta1Status: result.beta1Status,
		meanDegree: result.meanDegree,
		warnings: Object.freeze([...result.warnings]),
		preview: Object.freeze({
			x: Object.freeze(Array.from(snapshot.x)),
			y: Object.freeze(Array.from(snapshot.y)),
		}),
	})
}

export type ParameterSweepAnalyzer = (
	snapshot: PointCloudSnapshot,
	epsilon: number,
	signal?: AbortSignal,
) => Promise<RipsComplexResult>

const throwIfSweepAborted = (signal: AbortSignal | undefined): void => {
	if (!signal?.aborted) return
	const error = new Error('Parameter sweep cancelled.')
	error.name = 'AbortError'
	throw error
}

export const runParameterSweep = async (
	plan: ParameterSweepPlan,
	evaluate: (parameterValue: number, sampleIndex: number) => Promise<PointCloudSnapshot>,
	analyze: ParameterSweepAnalyzer,
	signal?: AbortSignal,
): Promise<ParameterSweepResult> => {
	const samples: ParameterSweepSample[] = []
	for (let index = 0; index < plan.values.length; index++) {
		throwIfSweepAborted(signal)
		const parameterValue = plan.values[index]
		if (parameterValue === undefined) continue
		const snapshot = await evaluate(parameterValue, index)
		throwIfSweepAborted(signal)
		if (snapshot.experimentId !== plan.experimentId || snapshot.stateVersion !== plan.experimentStateVersion) {
			throw new Error('Sweep sample belongs to a different experiment/state version.')
		}
		if (snapshot.source !== plan.source || snapshot.metric !== 'euclidean' || snapshot.coordinateUnits !== 'css-px') {
			throw new Error('Sweep sample does not match the declared point-cloud analysis contract.')
		}
		if (plan.anchor.kind === 'frozen-simulation' && snapshot.simulationStep !== plan.anchor.simulationStep) {
			throw new Error('Frozen formula sweep changed the simulation step between samples.')
		}
		if (plan.anchor.kind === 'initial-conditions' && snapshot.simulationStep !== plan.anchor.stepCount) {
			throw new Error('Dynamic simulation sweep did not run the declared step count.')
		}
		const analysis = await analyze(snapshot, plan.epsilon, signal)
		throwIfSweepAborted(signal)
		samples.push(createParameterSweepSample(snapshot, parameterValue, analysis))
	}
	return Object.freeze({
		format: PARAMETER_SWEEP_FORMAT,
		version: PARAMETER_SWEEP_VERSION,
		plan,
		analyzer: Object.freeze({
			id: RIPS_COMPLEX_ANALYZER_ID,
			version: RIPS_COMPLEX_ANALYZER_VERSION,
			metric: 'euclidean' as const,
			coordinateUnits: 'css-px' as const,
			approximation: 'full-point-cloud' as const,
		}),
		samples: Object.freeze(samples),
	})
}
