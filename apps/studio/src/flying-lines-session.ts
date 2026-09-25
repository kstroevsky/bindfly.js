import { createAdaptiveProximityDerivation } from '../../../src-v2/analysis/adaptive-proximity-derivation.ts'
import { createSeededRandom, getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, ParameterValues, RenderFrame, Simulation, SimulationStep, Viewport } from '../../../src-v2/core/index.ts'
import { flyingLinesDefinition, snapshotFlyingLinesState } from '../../../src-v2/effects/flying-lines/definition.ts'
import { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import type { FlyingLinesInput, FlyingLinesState } from '../../../src-v2/effects/flying-lines/types.ts'
import { MAXIMUM_MOVING_POINT_COUNT } from '../../../src-v2/effects/moving-points/parameters.ts'
import { createFlyingLinesCanvasRenderer } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
import type { FlyingLinesRenderView } from '../../../src-v2/rendering/flying-lines.ts'
import { createStage15FrameTimer } from './experiment-session.ts'
import type { ExperimentSession, ExperimentTelemetry } from './experiment-session.ts'

export interface CreateFlyingLinesSessionOptions {
	readonly canvas: HTMLCanvasElement | OffscreenCanvas
	readonly parameters: ParameterValues<typeof flyingLinesParameters>
	readonly seed: string
	readonly viewport: Viewport
}

export type FlyingLinesSession = ExperimentSession<
	typeof flyingLinesParameters,
	FlyingLinesInput,
	FlyingLinesState,
	ExperimentTelemetry
>

export const createFlyingLinesSession = (options: CreateFlyingLinesSessionOptions): FlyingLinesSession => {
	let parameters = options.parameters
	let viewport = options.viewport
	let simulation: Simulation<FlyingLinesState, FlyingLinesInput> = flyingLinesDefinition.createSimulation({
		random: createSeededRandom(options.seed),
		viewport,
	}, parameters)
	const renderer = createFlyingLinesCanvasRenderer(options.canvas)
	const proximity = createAdaptiveProximityDerivation(MAXIMUM_MOVING_POINT_COUNT)
	const frameTimer = createStage15FrameTimer()
	let view: FlyingLinesRenderView = {
		background: parameters.background,
		particles: simulation.state.particles,
		edges: proximity.result,
	}
	let droppedSteps = 0
	let telemetry: ExperimentTelemetry = {
		points: simulation.state.particles.count,
		edges: 0,
		components: simulation.state.particles.count,
		step: 0,
		frameMs: 0,
		droppedSteps,
		searchBackend: proximity.backend,
	}
	let disposed = false

	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed Flying Lines session.')
	}
	const refreshDerivedOwners = () => {
		view = {
			background: parameters.background,
			particles: simulation.state.particles,
			edges: proximity.result,
		}
	}
	const rebuild = () => {
		simulation.dispose()
		simulation = flyingLinesDefinition.createSimulation({ random: createSeededRandom(options.seed), viewport }, parameters)
		refreshDerivedOwners()
	}

	return {
		get parameters() { return parameters },
		get telemetry() { return telemetry },
		step: (step: SimulationStep) => {
			assertActive()
			frameTimer.measureSimulation(() => simulation.step(step))
		},
		render: (frame: RenderFrame) => {
			assertActive()
			const startedAt = performance.now()
			const derived = frameTimer.measure(() => proximity.update({
				points: simulation.state.particles,
				connectionRadius: parameters.connectionRadius,
			}))
			const edges = derived.value
			if (view.edges !== edges) view = { ...view, edges }
			const rendered = frameTimer.measure(() => renderer.render(view, frame))
			const stage15Timing = frameTimer.finish(derived.durationMs, rendered.durationMs)
			telemetry = {
				points: simulation.state.particles.count,
				edges: edges.edgeCount,
				components: edges.componentCount,
				step: frame.simulationStepIndex,
				frameMs: performance.now() - startedAt,
				...stage15Timing,
				droppedSteps,
				searchBackend: proximity.backend,
			}
			return telemetry
		},
		applyInput: (input: FlyingLinesInput) => {
			assertActive()
			simulation.applyInput(input)
		},
		updateParameters: (patch: ParameterPatch<typeof flyingLinesParameters>) => {
			assertActive()
			const invalidation = getParameterPatchInvalidation(flyingLinesParameters, patch)
			const normalized = normalizeParameters(flyingLinesParameters, { ...parameters, ...patch })
			if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid Flying Lines parameter patch.')
			parameters = normalized.value
			if (invalidation === 'hot-update') {
				refreshDerivedOwners()
			} else if (invalidation === 'reset-simulation') {
				rebuild()
			} else {
				throw new Error('Flying Lines requires a runtime rebuild for this parameter patch.')
			}
		},
		resize: (nextViewport: Viewport) => {
			assertActive()
			viewport = nextViewport
			renderer.resize(viewport)
			simulation.resize(viewport)
		},
		reset: () => {
			assertActive()
			droppedSteps = 0
			frameTimer.reset()
			simulation.reset()
		},
		recordDroppedSteps: (count: number) => {
			assertActive()
			if (!Number.isInteger(count) || count < 0) throw new RangeError('Dropped step count must be a non-negative integer.')
			droppedSteps += count
			telemetry = { ...telemetry, droppedSteps }
		},
		snapshot: () => {
			assertActive()
			return snapshotFlyingLinesState(simulation.state)
		},
		dispose: () => {
			if (disposed) return
			disposed = true
			simulation.dispose()
			proximity.dispose()
			renderer.dispose()
		},
	}
}
