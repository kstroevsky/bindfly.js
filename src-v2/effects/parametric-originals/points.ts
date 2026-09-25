import type { Derivation } from '../../core/index.ts'
import { evaluateFormula, evaluateFormulaTransformComparisonDetailed2D } from '../../formula/index.ts'
import type { FormulaProgram } from '../../formula/index.ts'

import type {
	ParametricFormulaComparisonDerivationInput,
	ParametricFormulaComparisonPointBuffer,
	ParametricFormulaScopeInput,
	ParametricFormulaAxisProbe,
	ParametricPointProbe,
	ParametricPointBuffer,
	ParametricPointDerivationInput,
} from './types.ts'

export const FORMULA_COMPARISON_VALIDITY_VERSION = 1
export const FORMULA_COMPARISON_VALIDITY = Object.freeze({
	bothInvalid: 0,
	bothValid: 1,
	aInvalid: 2,
	bInvalid: 3,
} as const)

export type FormulaComparisonValidity = typeof FORMULA_COMPARISON_VALIDITY[keyof typeof FORMULA_COMPARISON_VALIDITY]
export type ParametricComparisonPointView = 'a' | 'b' | 'morph'

const missing = Number.NaN

export const createParametricFormulaScope = ({
	state,
	kind,
	pointIndex,
	viewportWidth,
	viewportHeight,
	weight,
}: ParametricFormulaScopeInput): Readonly<Record<'a' | 'angle' | 'distance' | 'positionX' | 'positionY' | 'weight', number>> => {
	if (!Number.isInteger(pointIndex) || pointIndex < 0 || pointIndex >= state.phases.count) {
		throw new RangeError(`Parametric point index ${pointIndex} is outside the active point range.`)
	}
	const radius = Math.min(viewportWidth, viewportHeight) / 2
	const particleSpacing = 2 * Math.PI / state.phases.count
	const preAngle = Math.PI / (2 * state.phases.count)
	const angle = kind === 'pulse'
		? particleSpacing * pointIndex + Math.floor(pointIndex / state.phases.count) * Math.PI / 2
		: particleSpacing * pointIndex + pointIndex * preAngle
	const distance = radius * (angle / (2 * Math.PI)) * 2
	return {
		a: state.phases.values[pointIndex] ?? state.accumulator,
		angle,
		distance,
		positionX: state.centerX,
		positionY: state.centerY,
		weight,
	}
}

const probeFormulaAxis = (
	program: FormulaProgram,
	scope: Readonly<Record<string, number>>,
): ParametricFormulaAxisProbe => {
	const trace: ParametricFormulaAxisProbe['trace'][number][] = []
	const result = evaluateFormula(program, scope, (entry) => trace.push({
		expression: program.source.slice(entry.start, entry.end),
		start: entry.start,
		end: entry.end,
		value: entry.value,
	}))
	return result.ok ? { value: result.value, trace } : { error: result.error, trace }
}

export const probeParametricFormulaPoint = (
	input: ParametricFormulaComparisonDerivationInput,
	pointIndex: number,
	simulationStep: number,
): ParametricPointProbe => {
	const scope = createParametricFormulaScope({
		state: input.state,
		kind: input.kind,
		pointIndex,
		viewportWidth: input.viewportWidth,
		viewportHeight: input.viewportHeight,
		weight: input.weight,
	})
	const a = { x: probeFormulaAxis(input.formulaA.x, scope), y: probeFormulaAxis(input.formulaA.y, scope) }
	const b = { x: probeFormulaAxis(input.formulaB.x, scope), y: probeFormulaAxis(input.formulaB.y, scope) }
	const aValid = a.x.value !== undefined && a.y.value !== undefined
	const bValid = b.x.value !== undefined && b.y.value !== undefined
	const validity = aValid && bValid
		? FORMULA_COMPARISON_VALIDITY.bothValid
		: aValid ? FORMULA_COMPARISON_VALIDITY.bInvalid
			: bValid ? FORMULA_COMPARISON_VALIDITY.aInvalid : FORMULA_COMPARISON_VALIDITY.bothInvalid
	if (!aValid || !bValid) return { kind: 'point-probe', pointId: pointIndex, simulationStep, scope, validity, a, b }
	const inverse = 1 - input.formulaMorph
	const ax = a.x.value as number
	const ay = a.y.value as number
	const bx = b.x.value as number
	const by = b.y.value as number
	const dx = bx - ax
	const dy = by - ay
	return {
		kind: 'point-probe',
		pointId: pointIndex,
		simulationStep,
		scope,
		validity,
		a,
		b,
		morph: { x: inverse * ax + input.formulaMorph * bx, y: inverse * ay + input.formulaMorph * by },
		displacement: { dx, dy, magnitude: Math.hypot(dx, dy) },
	}
}

export const createParametricFormulaComparisonDerivation = (
	maximumPointCount: number,
): Derivation<ParametricFormulaComparisonDerivationInput, ParametricFormulaComparisonPointBuffer> => {
	if (!Number.isInteger(maximumPointCount) || maximumPointCount <= 0) {
		throw new RangeError('maximumPointCount must be a positive integer.')
	}
	const result: ParametricFormulaComparisonPointBuffer = {
		count: 0,
		capacity: maximumPointCount,
		ids: new Uint32Array(maximumPointCount),
		ax: new Float64Array(maximumPointCount),
		ay: new Float64Array(maximumPointCount),
		bx: new Float64Array(maximumPointCount),
		by: new Float64Array(maximumPointCount),
		mx: new Float64Array(maximumPointCount),
		my: new Float64Array(maximumPointCount),
		dx: new Float64Array(maximumPointCount),
		dy: new Float64Array(maximumPointCount),
		magnitude: new Float64Array(maximumPointCount),
		validity: new Uint8Array(maximumPointCount),
		invalidFormulaPointCount: 0,
	}
	let disposed = false

	const clearNumericSlots = (index: number) => {
		result.ax[index] = missing
		result.ay[index] = missing
		result.bx[index] = missing
		result.by[index] = missing
		result.mx[index] = missing
		result.my[index] = missing
		result.dx[index] = missing
		result.dy[index] = missing
		result.magnitude[index] = missing
	}

	return {
		result,
		update: (input) => {
			if (disposed) throw new Error('Cannot update disposed parametric formula comparison points.')
			if (input.state.phases.count > maximumPointCount) {
				throw new RangeError(`Point count ${input.state.phases.count} exceeds derivation maximum ${maximumPointCount}.`)
			}
			result.count = input.state.phases.count
			result.invalidFormulaPointCount = 0
			for (let index = 0; index < result.count; index++) {
				result.ids[index] = index
				result.validity[index] = FORMULA_COMPARISON_VALIDITY.bothInvalid
				clearNumericSlots(index)
				const evaluated = evaluateFormulaTransformComparisonDetailed2D({
					a: input.formulaA,
					b: input.formulaB,
					morph: input.formulaMorph,
				}, createParametricFormulaScope({
					state: input.state,
					kind: input.kind,
					pointIndex: index,
					viewportWidth: input.viewportWidth,
					viewportHeight: input.viewportHeight,
					weight: input.weight,
				}))
				if (!evaluated.ok) {
					result.invalidFormulaPointCount++
					continue
				}
				const { a, b, morphed } = evaluated.value
				if (a.ok) {
					result.ax[index] = a.value.x
					result.ay[index] = a.value.y
				}
				if (b.ok) {
					result.bx[index] = b.value.x
					result.by[index] = b.value.y
				}
				if (!a.ok || !b.ok || !morphed) {
					result.validity[index] = a.ok
						? FORMULA_COMPARISON_VALIDITY.bInvalid
						: b.ok ? FORMULA_COMPARISON_VALIDITY.aInvalid : FORMULA_COMPARISON_VALIDITY.bothInvalid
					result.invalidFormulaPointCount++
					continue
				}
				const dx = b.value.x - a.value.x
				const dy = b.value.y - a.value.y
				result.validity[index] = FORMULA_COMPARISON_VALIDITY.bothValid
				result.mx[index] = morphed.x
				result.my[index] = morphed.y
				result.dx[index] = dx
				result.dy[index] = dy
				result.magnitude[index] = Math.hypot(dx, dy)
			}
			return result
		},
		dispose: () => {
			disposed = true
			result.count = 0
			result.invalidFormulaPointCount = 0
		},
	}
}

const isViewValid = (validity: number, source: ParametricComparisonPointView): boolean => {
	if (source === 'morph') return validity === FORMULA_COMPARISON_VALIDITY.bothValid
	if (source === 'a') return validity === FORMULA_COMPARISON_VALIDITY.bothValid || validity === FORMULA_COMPARISON_VALIDITY.bInvalid
	return validity === FORMULA_COMPARISON_VALIDITY.bothValid || validity === FORMULA_COMPARISON_VALIDITY.aInvalid
}

export const createParametricComparisonPointViewDerivation = (
	maximumPointCount: number,
	source: ParametricComparisonPointView,
): Derivation<ParametricFormulaComparisonPointBuffer, ParametricPointBuffer> => {
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
		update: (comparison) => {
			if (disposed) throw new Error('Cannot update disposed parametric comparison point view.')
			if (comparison.count > maximumPointCount) {
				throw new RangeError(`Point count ${comparison.count} exceeds derivation maximum ${maximumPointCount}.`)
			}
			result.count = 0
			for (let index = 0; index < comparison.count; index++) {
				if (!isViewValid(comparison.validity[index] ?? FORMULA_COMPARISON_VALIDITY.bothInvalid, source)) continue
				const target = result.count++
				result.ids[target] = comparison.ids[index] ?? index
				result.x[target] = source === 'a'
					? comparison.ax[index] ?? missing
					: source === 'b' ? comparison.bx[index] ?? missing : comparison.mx[index] ?? missing
				result.y[target] = source === 'a'
					? comparison.ay[index] ?? missing
					: source === 'b' ? comparison.by[index] ?? missing : comparison.my[index] ?? missing
			}
			result.invalidFormulaPointCount = comparison.count - result.count
			return result
		},
		dispose: () => {
			disposed = true
			result.count = 0
			result.invalidFormulaPointCount = 0
		},
	}
}

export const createParametricPointDerivation = (
	maximumPointCount: number,
): Derivation<ParametricPointDerivationInput, ParametricPointBuffer> => {
	const comparison = createParametricFormulaComparisonDerivation(maximumPointCount)
	const view = createParametricComparisonPointViewDerivation(maximumPointCount, 'morph')
	return {
		result: view.result,
		update: (input) => view.update(comparison.update(input)),
		dispose: () => {
			comparison.dispose()
			view.dispose()
		},
	}
}
