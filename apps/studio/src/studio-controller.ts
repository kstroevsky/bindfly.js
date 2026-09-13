import { createProximityGraphWorkspace } from '../../../src-v2/analysis/proximity-graph.ts'
import { createUniformGridProximityGraphWorkspace, shouldUseUniformGrid } from '../../../src-v2/analysis/uniform-grid-proximity-graph.ts'
import { getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/parameters.ts'
import type { ParameterPatch, ParameterValues } from '../../../src-v2/core/parameters.ts'
import { createSeededRandom } from '../../../src-v2/core/random.ts'
import type { Simulation } from '../../../src-v2/core/simulation.ts'
import type { Viewport } from '../../../src-v2/core/viewport.ts'
import { flyingLinesDefinition } from '../../../src-v2/effects/flying-lines/definition.ts'
import { applyFlyingLinesHotParameters } from '../../../src-v2/effects/flying-lines/parameter-update.ts'
import { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import type { FlyingLinesInput, FlyingLinesState } from '../../../src-v2/effects/flying-lines/types.ts'
import { createFlyingLinesCanvasRenderer } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
import type { FlyingLinesRenderView } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
import type { ExecutionBackend } from '../../../src-v2/runtime/execution-backend.ts'
import { FixedStepClock } from '../../../src-v2/runtime/fixed-step-clock.ts'
import { browserAnimationFrameScheduler, FixedStepLoop } from '../../../src-v2/runtime/fixed-step-loop.ts'
import { MainThreadRuntime } from '../../../src-v2/runtime/main-thread-runtime.ts'
import type { RuntimeEvent } from '../../../src-v2/runtime/protocol.ts'
import type { RuntimeState } from '../../../src-v2/runtime/lifecycle.ts'
import { WorkerRuntime } from '../../../src-v2/runtime/worker-runtime.ts'

export type StudioRuntimeKind = 'main' | 'worker'

export interface StudioMetrics {
	readonly points: number
	readonly edges: number
	readonly components: number
	readonly step: number
	readonly frameMs: number
	readonly droppedSteps: number
	readonly searchBackend: 'brute' | 'grid'
}

export interface StudioController {
	readonly kind: StudioRuntimeKind
	readonly state: RuntimeState
	pause(): Promise<void>
	resume(): Promise<void>
	reset(): Promise<void>
	resize(viewport: Viewport): Promise<void>
	applyInput(input: FlyingLinesInput): Promise<void>
	updateParameters(patch: ParameterPatch<typeof flyingLinesParameters>): Promise<void>
	dispose(): Promise<void>
}

export interface CreateStudioControllerOptions {
	readonly canvas: HTMLCanvasElement
	readonly viewport: Viewport
	readonly parameters: ParameterValues<typeof flyingLinesParameters>
	readonly seed: string
	readonly onMetrics: (metrics: StudioMetrics) => void
	readonly onFailure: (error: unknown) => void
}

export const createMainStudioController = async (options: CreateStudioControllerOptions): Promise<StudioController> => {
	let parameters = options.parameters
	let viewport = options.viewport
	let simulation: Simulation<FlyingLinesState, FlyingLinesInput> = flyingLinesDefinition.createSimulation({
		random: createSeededRandom(options.seed), viewport,
	}, parameters)
	const renderer = createFlyingLinesCanvasRenderer(options.canvas)
	const brute = createProximityGraphWorkspace(500)
	const grid = createUniformGridProximityGraphWorkspace(500)
	let workspace = shouldUseUniformGrid(simulation.state.particles, simulation.state.connectionRadius) ? grid : brute
	let view: FlyingLinesRenderView = { background: simulation.state.background, particles: simulation.state.particles, edges: workspace.result }
	let droppedSteps = 0
	const refreshDerivedOwners = () => {
		workspace = shouldUseUniformGrid(simulation.state.particles, simulation.state.connectionRadius) ? grid : brute
		view = { background: simulation.state.background, particles: simulation.state.particles, edges: workspace.result }
	}

	const rebuild = () => {
		simulation.dispose()
		simulation = flyingLinesDefinition.createSimulation({ random: createSeededRandom(options.seed), viewport }, parameters)
		refreshDerivedOwners()
	}
	const loop = new FixedStepLoop<FlyingLinesInput, ParameterPatch<typeof flyingLinesParameters>>({
		clock: new FixedStepClock({ stepSeconds: flyingLinesDefinition.timing.fixedStepSeconds, maxCatchUpSteps: 8 }),
		scheduler: browserAnimationFrameScheduler,
		callbacks: {
			step: (step) => simulation.step(step),
			render: (frame) => {
				const startedAt = performance.now()
				workspace.analyze(simulation.state.particles, simulation.state.connectionRadius)
				renderer.render(view, frame)
				if (frame.frameIndex % 6 === 0) options.onMetrics({
					points: simulation.state.particles.count,
					edges: workspace.result.edgeCount,
					components: workspace.result.componentCount,
					step: frame.simulationStepIndex,
					frameMs: performance.now() - startedAt,
					droppedSteps,
					searchBackend: workspace === grid ? 'grid' : 'brute',
				})
			},
			applyInput: (input) => simulation.applyInput(input),
			applyParameterPatch: (patch) => {
				const invalidation = getParameterPatchInvalidation(flyingLinesParameters, patch)
				const normalized = normalizeParameters(flyingLinesParameters, { ...parameters, ...patch })
				if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid parameter patch.')
				parameters = normalized.value
				if (invalidation === 'hot-update') {
					applyFlyingLinesHotParameters(simulation.state, parameters)
					refreshDerivedOwners()
				} else if (invalidation === 'reset-simulation') rebuild()
				else throw new Error('Flying Lines requires a runtime rebuild for this parameter patch.')
			},
			reset: () => { droppedSteps = 0; simulation.reset() },
			resize: (nextViewport) => { viewport = nextViewport; renderer.resize(viewport); simulation.resize(viewport) },
			dispose: () => { simulation.dispose(); renderer.dispose() },
			onOverload: ({ droppedStepCount }) => { droppedSteps += droppedStepCount },
			onError: options.onFailure,
		},
	})
	const backend = new MainThreadRuntime<typeof flyingLinesParameters, FlyingLinesInput>(loop)
	await backend.initialize()
	await backend.resize(viewport)
	await backend.start()
	return wrapBackend('main', backend)
}

export const createWorkerStudioController = async (options: CreateStudioControllerOptions): Promise<StudioController> => {
	const offscreenCanvas = options.canvas.transferControlToOffscreen()
	const backend = new WorkerRuntime<typeof flyingLinesParameters, FlyingLinesInput, {
		canvas: OffscreenCanvas
		viewport: Viewport
		parameters: ParameterValues<typeof flyingLinesParameters>
		seed: string
	}>({
		createWorker: () => new Worker(new URL('./flying-lines.worker.ts', import.meta.url), { type: 'module' }),
		initializePayload: { canvas: offscreenCanvas, viewport: options.viewport, parameters: options.parameters, seed: options.seed },
		initializeTransfer: [offscreenCanvas],
		onFailure: options.onFailure,
		onEvent: (event: RuntimeEvent) => {
			if (event.type !== 'telemetry' || typeof event.payload !== 'object' || event.payload === null) return
			const value = event.payload as Record<string, unknown>
			options.onMetrics({
				points: Number(value.points ?? 0), edges: Number(value.edges ?? 0), components: Number(value.components ?? 0),
				step: Number(value.step ?? 0), frameMs: Number(value.frameMs ?? 0), droppedSteps: Number(value.droppedSteps ?? 0),
				searchBackend: value.searchBackend === 'grid' ? 'grid' : 'brute',
			})
		},
	})
	await backend.initialize()
	await backend.start()
	return wrapBackend('worker', backend)
}

const wrapBackend = (
	kind: StudioRuntimeKind,
	backend: ExecutionBackend<typeof flyingLinesParameters, FlyingLinesInput>,
): StudioController => ({
	kind,
	get state() { return backend.state },
	pause: () => backend.pause(), resume: () => backend.resume(), reset: () => backend.reset(),
	resize: (viewport) => backend.resize(viewport), applyInput: (input) => backend.applyInput(input),
	updateParameters: (patch) => backend.updateParameters(patch), dispose: () => backend.dispose(),
})
