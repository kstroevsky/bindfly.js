import { createAdaptiveProximityDerivation } from '../../../src-v2/analysis/adaptive-proximity-derivation.ts'
import { createSeededRandom, getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, RenderFrame, Simulation, SimulationStep, Viewport } from '../../../src-v2/core/index.ts'
import type { ParametricOriginalDefinitionBundle } from '../../../src-v2/effects/parametric-originals/definition.ts'
import { snapshotParametricOriginalState } from '../../../src-v2/effects/parametric-originals/definition.ts'
import { compileParametricOriginalFormulaPair } from '../../../src-v2/effects/parametric-originals/formula.ts'
import { MAXIMUM_PARAMETRIC_POINT_COUNT } from '../../../src-v2/effects/parametric-originals/parameters.ts'
import { createParametricPointDerivation } from '../../../src-v2/effects/parametric-originals/points.ts'
import type { ParametricOriginalInput, ParametricOriginalParameters, ParametricOriginalState } from '../../../src-v2/effects/parametric-originals/types.ts'
import { createFlyingLinesCanvasRenderer } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
import type { FlyingLinesRenderView } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
import type { ExperimentSession, ExperimentTelemetry } from './experiment-session.ts'

export interface CreateParametricOriginalSessionOptions {
	readonly canvas: HTMLCanvasElement | OffscreenCanvas
	readonly parameters: ParametricOriginalParameters
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
	let viewport = options.viewport
	const initialFormulas = compileParametricOriginalFormulaPair(parameters)
	if (!initialFormulas.ok) throw new Error(initialFormulas.error)
	let formulas = initialFormulas.value
	let simulation: Simulation<ParametricOriginalState, ParametricOriginalInput> = bundle.definition.createSimulation({
		random: createSeededRandom(options.seed), viewport,
	}, parameters)
	const points = createParametricPointDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const pointsA = createParametricPointDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const pointsB = createParametricPointDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const proximity = createAdaptiveProximityDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const proximityA = createAdaptiveProximityDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const proximityB = createAdaptiveProximityDerivation(MAXIMUM_PARAMETRIC_POINT_COUNT)
	const renderer = createFlyingLinesCanvasRenderer(options.canvas)
	let view: FlyingLinesRenderView = {
		background: parameters.background,
		particles: points.result,
		edges: proximity.result,
	}
	let droppedSteps = 0
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

	return {
		get parameters() { return parameters },
		get telemetry() { return telemetry },
		step: (step: SimulationStep) => { assertActive(); simulation.step(step) },
		render: (frame: RenderFrame) => {
			assertActive()
			const startedAt = performance.now()
			const derivePoints = (derivation: ReturnType<typeof createParametricPointDerivation>, formulaMorph: number) => derivation.update({
				state: simulation.state,
				kind: bundle.spec.kind,
				viewportWidth: viewport.cssWidth,
				viewportHeight: viewport.cssHeight,
				weight: parameters.weight,
				formulaA: formulas.a,
				formulaB: formulas.b,
				formulaMorph,
			})
			const derivedPoints = derivePoints(points, parameters.formulaMorph)
			const edges = proximity.update({ points: derivedPoints, connectionRadius: parameters.connectionRadius })
			if (parameters.formulaView === 'compare') {
				const derivedPointsA = derivePoints(pointsA, 0)
				const derivedPointsB = derivePoints(pointsB, 1)
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
		dispose: () => {
			if (disposed) return
			disposed = true
			simulation.dispose()
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
