import { createAdaptiveProximityDerivation } from '../../../src-v2/analysis/adaptive-proximity-derivation.ts'
import { createPointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import { createSeededRandom, getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, RenderFrame, Simulation, SimulationStep, Viewport } from '../../../src-v2/core/index.ts'
import type { ParametricOriginalDefinitionBundle } from '../../../src-v2/effects/parametric-originals/definition.ts'
import { snapshotParametricOriginalState } from '../../../src-v2/effects/parametric-originals/definition.ts'
import { compileParametricOriginalFormulaPair } from '../../../src-v2/effects/parametric-originals/formula.ts'
import {
	MAXIMUM_PARAMETRIC_POINT_COUNT,
	PARAMETRIC_ORIGINAL_FORMULA_PARAMETERS,
} from '../../../src-v2/effects/parametric-originals/parameters.ts'
import {
	FORMULA_COMPARISON_VALIDITY,
	createParametricComparisonPointViewDerivation,
	createParametricFormulaComparisonDerivation,
	probeParametricFormulaPoint,
} from '../../../src-v2/effects/parametric-originals/points.ts'
import type { ParametricOriginalInput, ParametricOriginalParameters, ParametricOriginalState } from '../../../src-v2/effects/parametric-originals/types.ts'
import { createFormulaParameterScope } from '../../../src-v2/formula/index.ts'
import type { RuntimeFormulaView } from '../../../src-v2/runtime/protocol.ts'
import {
	DIFFERENCE_DISCONTINUITY_KIND,
	createFlyingLinesCanvasRenderer,
} from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
import type { FlyingLinesDifferenceView, FlyingLinesRenderView } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
import type { ExperimentSession, ExperimentTelemetry } from './experiment-session.ts'

export interface CreateParametricOriginalSessionOptions {
	readonly canvas: HTMLCanvasElement | OffscreenCanvas
	readonly parameters: ParametricOriginalParameters
	readonly formulaView: RuntimeFormulaView
	readonly seed: string
	readonly viewport: Viewport
}

export const createParametricOriginalSession = (
	bundle: ParametricOriginalDefinitionBundle,
	options: CreateParametricOriginalSessionOptions,
): ExperimentSession<
	ParametricOriginalDefinitionBundle['definition']['parameters'],
	ParametricOriginalInput,
	ParametricOriginalState,
	ExperimentTelemetry
> => {
	let parameters = options.parameters
	let formulaView = options.formulaView
	let viewport = options.viewport
	const initialFormulas = compileParametricOriginalFormulaPair(parameters)
	if (!initialFormulas.ok) throw new Error(initialFormulas.error)
	let formulas = initialFormulas.value
	let simulation: Simulation<ParametricOriginalState, ParametricOriginalInput> = bundle.definition.createSimulation({
		random: createSeededRandom(options.seed), viewport,
	}, parameters)
	const comparisonPoints = createParametricFormulaComparisonDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const points = createParametricComparisonPointViewDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT, 'morph')
	const pointsA = createParametricComparisonPointViewDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT, 'a')
	const pointsB = createParametricComparisonPointViewDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT, 'b')
	const proximity = createAdaptiveProximityDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const proximityA = createAdaptiveProximityDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const proximityB = createAdaptiveProximityDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const renderer = createFlyingLinesCanvasRenderer(options.canvas)
	const magnitudeScratch = new Float64Array(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const difference: FlyingLinesDifferenceView = {
		mode: 'vector',
		count: 0,
		ids: new Uint32Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		ax: new Float64Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		ay: new Float64Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		bx: new Float64Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		by: new Float64Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		magnitude: new Float64Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		robustMagnitudeScale: 1,
		outliers: new Uint8Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		discontinuityCount: 0,
		discontinuityX: new Float64Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		discontinuityY: new Float64Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		discontinuityKind: new Uint8Array(MAXIMUM_PARAMETRIC_POINT_COUNT),
		unlocatedDiscontinuityCount: 0,
	}
	let view: FlyingLinesRenderView = {
		background: parameters.background,
		particles: points.result,
		edges: proximity.result,
	}
	let droppedSteps = 0
	let pointCloudSnapshotCounter = 0
	let telemetry: ExperimentTelemetry = {
		points: points.result.count,
		edges: 0,
		components: 0,
		step: 0,
		frameMs: 0,
		droppedSteps,
		searchBackend: proximity.backend,
	}
	let disposed = false
	const assertActive = () => {
		if (disposed) throw new Error(`Cannot use a disposed ${bundle.definition.id} session.`)
	}
	const rebuild = () => {
		simulation.dispose()
		simulation = bundle.definition.createSimulation({ random: createSeededRandom(options.seed), viewport }, parameters)
	}
	const currentComparisonInput = () => ({
		state: simulation.state,
		kind: bundle.spec.kind,
		viewportWidth: viewport.cssWidth,
		viewportHeight: viewport.cssHeight,
		weight: parameters.weight,
		formulaParameters: createFormulaParameterScope(PARAMETRIC_ORIGINAL_FORMULA_PARAMETERS, parameters),
		formulaA: formulas.a,
		formulaB: formulas.b,
		formulaMorph: parameters.formulaMorph,
	})
	const formulaConfigurationHash = () => {
		const source = JSON.stringify([
			parameters.formulaAX,
			parameters.formulaAY,
			parameters.formulaBX,
			parameters.formulaBY,
			parameters.formulaMorph,
			parameters.weight,
			parameters.phaseMode,
			parameters.controlledPhase,
			parameters.k,
			parameters.b,
		])
		let hash = 0x811c9dc5
		for (let index = 0; index < source.length; index++) {
			hash ^= source.charCodeAt(index)
			hash = Math.imul(hash, 0x01000193)
		}
		return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
	}
	const updateDifference = (comparison: ReturnType<typeof comparisonPoints.update>, mode: FlyingLinesDifferenceView['mode']) => {
		let validCount = 0
		let discontinuityCount = 0
		let unlocatedDiscontinuityCount = 0
		for (let index = 0; index < comparison.count; index++) {
			const validity = comparison.validity[index] ?? FORMULA_COMPARISON_VALIDITY.bothInvalid
			if (validity === FORMULA_COMPARISON_VALIDITY.bothValid) {
				const target = validCount++
				difference.ids[target] = comparison.ids[index] ?? index
				difference.ax[target] = comparison.ax[index] ?? 0
				difference.ay[target] = comparison.ay[index] ?? 0
				difference.bx[target] = comparison.bx[index] ?? 0
				difference.by[target] = comparison.by[index] ?? 0
				const magnitude = comparison.magnitude[index] ?? 0
				difference.magnitude[target] = magnitude
				magnitudeScratch[target] = magnitude
				continue
			}
			if (validity === FORMULA_COMPARISON_VALIDITY.bothInvalid) {
				unlocatedDiscontinuityCount++
				continue
			}
			const target = discontinuityCount++
			if (validity === FORMULA_COMPARISON_VALIDITY.aInvalid) {
				difference.discontinuityX[target] = comparison.bx[index] ?? Number.NaN
				difference.discontinuityY[target] = comparison.by[index] ?? Number.NaN
				difference.discontinuityKind[target] = DIFFERENCE_DISCONTINUITY_KIND.aInvalid
			} else {
				difference.discontinuityX[target] = comparison.ax[index] ?? Number.NaN
				difference.discontinuityY[target] = comparison.ay[index] ?? Number.NaN
				difference.discontinuityKind[target] = DIFFERENCE_DISCONTINUITY_KIND.bInvalid
			}
		}
		const sorted = magnitudeScratch.subarray(0, validCount)
		sorted.sort()
		const percentileIndex = validCount === 0 ? 0 : Math.max(0, Math.ceil(validCount * 0.95) - 1)
		const percentile = validCount === 0 ? 1 : sorted[percentileIndex] ?? 1
		const robustMagnitudeScale = Number.isFinite(percentile) && percentile > 1e-12 ? percentile : 1
		for (let index = 0; index < validCount; index++) {
			difference.outliers[index] = (difference.magnitude[index] ?? 0) > robustMagnitudeScale ? 1 : 0
		}
		return Object.assign(difference, {
			mode,
			count: validCount,
			robustMagnitudeScale,
			discontinuityCount,
			unlocatedDiscontinuityCount,
		})
	}

	return {
		get parameters() { return parameters },
		get telemetry() { return telemetry },
		step: (step: SimulationStep) => { assertActive(); simulation.step(step) },
		render: (frame: RenderFrame) => {
			assertActive()
			const startedAt = performance.now()
			const comparison = comparisonPoints.update(currentComparisonInput())
			const derivedPoints = points.update(comparison)
			const edges = proximity.update({ points: derivedPoints, connectionRadius: parameters.connectionRadius })
			if (formulaView === 'formula-a') {
				const derivedPointsA = pointsA.update(comparison)
				const edgesA = proximityA.update({ points: derivedPointsA, connectionRadius: parameters.connectionRadius })
				view = { background: parameters.background, particles: derivedPointsA, edges: edgesA }
			} else if (formulaView === 'formula-b') {
				const derivedPointsB = pointsB.update(comparison)
				const edgesB = proximityB.update({ points: derivedPointsB, connectionRadius: parameters.connectionRadius })
				view = { background: parameters.background, particles: derivedPointsB, edges: edgesB }
			} else if (formulaView === 'compare') {
				const derivedPointsA = pointsA.update(comparison)
				const derivedPointsB = pointsB.update(comparison)
				const edgesA = proximityA.update({ points: derivedPointsA, connectionRadius: parameters.connectionRadius })
				const edgesB = proximityB.update({ points: derivedPointsB, connectionRadius: parameters.connectionRadius })
				view = {
					background: parameters.background,
					particles: derivedPoints,
					edges,
					comparison: {
						a: { particles: derivedPointsA, edges: edgesA },
						b: { particles: derivedPointsB, edges: edgesB },
					},
				}
			} else if (formulaView === 'difference-vector' || formulaView === 'difference-magnitude') {
				view = {
					background: parameters.background,
					particles: derivedPoints,
					edges,
					difference: updateDifference(comparison, formulaView === 'difference-vector' ? 'vector' : 'magnitude'),
				}
			} else {
				view = { background: parameters.background, particles: derivedPoints, edges }
			}
			renderer.render(view, frame)
			telemetry = {
				points: derivedPoints.count,
				edges: edges.edgeCount,
				components: edges.componentCount,
				step: frame.simulationStepIndex,
				frameMs: performance.now() - startedAt,
				droppedSteps,
				searchBackend: proximity.backend,
			}
			return telemetry
		},
		applyInput: (input) => { assertActive(); simulation.applyInput(input) },
		updateParameters: (patch: ParameterPatch<ParametricOriginalDefinitionBundle['definition']['parameters']>) => {
			assertActive()
			const invalidation = getParameterPatchInvalidation(bundle.definition.parameters, patch)
			const normalized = normalizeParameters(bundle.definition.parameters, { ...parameters, ...patch })
			if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? `Invalid ${bundle.definition.id} parameter patch.`)
			const nextFormulas = compileParametricOriginalFormulaPair(normalized.value)
			if (!nextFormulas.ok) throw new Error(nextFormulas.error)
			parameters = normalized.value
			formulas = nextFormulas.value
			if (invalidation === 'reset-simulation') rebuild()
			else if (invalidation !== 'hot-update') throw new Error(`${bundle.definition.id} requires a runtime rebuild for this patch.`)
		},
		resize: (nextViewport) => {
			assertActive()
			viewport = nextViewport
			renderer.resize(viewport)
			simulation.resize(viewport)
		},
		reset: () => { assertActive(); droppedSteps = 0; simulation.reset() },
		recordDroppedSteps: (count) => {
			assertActive()
			if (!Number.isInteger(count) || count < 0) throw new RangeError('Dropped step count must be a non-negative integer.')
			droppedSteps += count
			telemetry = { ...telemetry, droppedSteps }
		},
		snapshot: () => { assertActive(); return snapshotParametricOriginalState(simulation.state) },
		updateFormulaView: (nextView) => {
			assertActive()
			formulaView = nextView
		},
		inspectPoint: ({ x, y, maxDistance = 14 }) => {
			assertActive()
			const comparison = comparisonPoints.result
			let nearestIndex = -1
			let nearestDistanceSquared = maxDistance * maxDistance
			for (let index = 0; index < comparison.count; index++) {
				const validity = comparison.validity[index] ?? FORMULA_COMPARISON_VALIDITY.bothInvalid
				let pointX: number
				let pointY: number
				if (validity === FORMULA_COMPARISON_VALIDITY.bothValid) {
					pointX = comparison.mx[index] ?? Number.NaN
					pointY = comparison.my[index] ?? Number.NaN
				} else if (validity === FORMULA_COMPARISON_VALIDITY.aInvalid) {
					pointX = comparison.bx[index] ?? Number.NaN
					pointY = comparison.by[index] ?? Number.NaN
				} else if (validity === FORMULA_COMPARISON_VALIDITY.bInvalid) {
					pointX = comparison.ax[index] ?? Number.NaN
					pointY = comparison.ay[index] ?? Number.NaN
				} else continue
				if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) continue
				const dx = pointX - x
				const dy = pointY - y
				const distanceSquared = dx * dx + dy * dy
				if (distanceSquared > nearestDistanceSquared) continue
				nearestDistanceSquared = distanceSquared
				nearestIndex = index
			}
			return nearestIndex < 0
				? { kind: 'no-point' as const }
				: probeParametricFormulaPoint(currentComparisonInput(), comparison.ids[nearestIndex] ?? nearestIndex, telemetry.step)
		},
		capturePointCloud: ({ source }) => {
			assertActive()
			const comparison = comparisonPoints.result
			const capturedPoints = source === 'formula-a'
				? pointsA.update(comparison)
				: source === 'formula-b' ? pointsB.update(comparison) : points.update(comparison)
			pointCloudSnapshotCounter += 1
			return createPointCloudSnapshot({
				snapshotId: `${bundle.definition.id}:${telemetry.step}:${source}:${pointCloudSnapshotCounter}`,
				experimentId: bundle.definition.id,
				stateVersion: bundle.definition.stateVersion,
				simulationStep: telemetry.step,
				source,
				points: capturedPoints,
				formulaConfigurationHash: formulaConfigurationHash(),
			})
		},
		dispose: () => {
			if (disposed) return
			disposed = true
			simulation.dispose()
			comparisonPoints.dispose()
			points.dispose()
			pointsA.dispose()
			pointsB.dispose()
			proximity.dispose()
			proximityA.dispose()
			proximityB.dispose()
			renderer.dispose()
		},
	}
}
