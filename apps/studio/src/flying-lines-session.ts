import { createProximityGraphWorkspace } from '../../../src-v2/analysis/proximity-graph.ts'
import { createUniformGridProximityGraphWorkspace, shouldUseUniformGrid } from '../../../src-v2/analysis/uniform-grid-proximity-graph.ts'
import { createSeededRandom, getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, ParameterValues, RenderFrame, Simulation, SimulationStep, Viewport } from '../../../src-v2/core/index.ts'
import { flyingLinesDefinition, snapshotFlyingLinesState } from '../../../src-v2/effects/flying-lines/definition.ts'
import { applyFlyingLinesHotParameters } from '../../../src-v2/effects/flying-lines/parameter-update.ts'
import { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import type { FlyingLinesInput, FlyingLinesState } from '../../../src-v2/effects/flying-lines/types.ts'
import { createFlyingLinesCanvasRenderer } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
import type { FlyingLinesRenderView } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
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
	const brute = createProximityGraphWorkspace(500)
	const grid = createUniformGridProximityGraphWorkspace(500)
	let workspace = shouldUseUniformGrid(simulation.state.particles, simulation.state.connectionRadius) ? grid : brute
	let view: FlyingLinesRenderView = {
		background: simulation.state.background,
		particles: simulation.state.particles,
		edges: workspace.result,
	}
	let droppedSteps = 0
	let telemetry: ExperimentTelemetry = {
		points: simulation.state.particles.count,
		edges: 0,
		components: simulation.state.particles.count,
		step: 0,
		frameMs: 0,
		droppedSteps,
		searchBackend: workspace === grid ? 'grid' : 'brute',
	}
	let disposed = false

	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed Flying Lines session.')
	}
	const refreshDerivedOwners = () => {
		workspace = shouldUseUniformGrid(simulation.state.particles, simulation.state.connectionRadius) ? grid : brute
		view = {
			background: simulation.state.background,
			particles: simulation.state.particles,
			edges: workspace.result,
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
			simulation.step(step)
		},
		render: (frame: RenderFrame) => {
			assertActive()
			const startedAt = performance.now()
			workspace.analyze(simulation.state.particles, simulation.state.connectionRadius)
			renderer.render(view, frame)
			telemetry = {
				points: simulation.state.particles.count,
				edges: workspace.result.edgeCount,
				components: workspace.result.componentCount,
				step: frame.simulationStepIndex,
				frameMs: performance.now() - startedAt,
				droppedSteps,
				searchBackend: workspace === grid ? 'grid' : 'brute',
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
				applyFlyingLinesHotParameters(simulation.state, parameters)
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
			renderer.dispose()
		},
	}
}
