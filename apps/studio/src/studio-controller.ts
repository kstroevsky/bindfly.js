import type { ParameterSchema } from '../../../src-v2/core/parameters.ts'
import type { RendererKind } from '../../../src-v2/core/capabilities.ts'
import type { Viewport } from '../../../src-v2/core/viewport.ts'
import type { ExecutionBackend } from '../../../src-v2/runtime/execution-backend.ts'
import { FixedStepClock } from '../../../src-v2/runtime/fixed-step-clock.ts'
import { browserAnimationFrameScheduler, FixedStepLoop } from '../../../src-v2/runtime/fixed-step-loop.ts'
import type { RuntimeState } from '../../../src-v2/runtime/lifecycle.ts'
import { MainThreadRuntime } from '../../../src-v2/runtime/main-thread-runtime.ts'
import type { RuntimeEvent, RuntimePointCloudCaptureRequest, RuntimePointInspectionRequest } from '../../../src-v2/runtime/protocol.ts'
import { WorkerRuntime } from '../../../src-v2/runtime/worker-runtime.ts'
import type {
	ExperimentTelemetry,
} from './experiment-session.ts'
import type {
	StudioExperimentPlugin,
	StudioFormulaView,
	StudioParameterPatch,
	StudioParameterValues,
} from './studio-experiment-plugin.ts'

export type StudioRuntimeKind = 'main' | 'worker'
export type StudioMetrics = ExperimentTelemetry

export interface StudioController {
	readonly kind: StudioRuntimeKind
	readonly state: RuntimeState
	pause(): Promise<void>
	resume(): Promise<void>
	step(): Promise<void>
	updateFormulaView(view: StudioFormulaView): Promise<void>
	inspectPoint(request: RuntimePointInspectionRequest): Promise<unknown>
	capturePointCloud(request: RuntimePointCloudCaptureRequest): Promise<unknown>
	reset(): Promise<void>
	resize(viewport: Viewport): Promise<void>
	applyInput(input: unknown): Promise<void>
	updateParameters(patch: StudioParameterPatch): Promise<void>
	dispose(): Promise<void>
}

export interface CreateStudioControllerOptions {
	readonly canvas: HTMLCanvasElement
	readonly rendererId: RendererKind
	readonly viewport: Viewport
	readonly plugin: StudioExperimentPlugin
	readonly parameters: StudioParameterValues
	readonly formulaView: StudioFormulaView
	readonly seed: string
	readonly startPaused?: boolean
	readonly onMetrics: (metrics: StudioMetrics) => void
	readonly onFailure: (error: unknown) => void
}

export const createMainStudioController = async (options: CreateStudioControllerOptions): Promise<StudioController> => {
	const supportsProfile = options.plugin.executionProfiles.some(({ rendererId, runtimeId }) =>
		rendererId === options.rendererId && runtimeId === 'main-thread')
	if (!supportsProfile) throw new Error(`Experiment '${options.plugin.id}' does not support the ${options.rendererId} main-thread profile.`)
	const session = options.plugin.createSession(options)
	const loop = new FixedStepLoop<unknown, StudioParameterPatch>({
		clock: new FixedStepClock({ stepSeconds: options.plugin.timing.fixedStepSeconds, maxCatchUpSteps: 8 }),
		scheduler: browserAnimationFrameScheduler,
		callbacks: {
			step: (step) => session.step(step),
			render: (frame) => {
				const telemetry = session.render(frame)
				if (frame.frameIndex % 6 === 0) options.onMetrics(telemetry)
			},
			applyInput: (input) => session.applyInput(input),
			applyParameterPatch: (patch) => session.updateParameters(patch),
			updateFormulaView: (view) => session.updateFormulaView?.(view),
			inspectPoint: (request) => {
				if (!session.inspectPoint) throw new Error(`Experiment '${options.plugin.id}' does not support point inspection.`)
				return session.inspectPoint(request)
			},
			capturePointCloud: (request) => {
				if (!session.capturePointCloud) throw new Error(`Experiment '${options.plugin.id}' does not support point-cloud capture.`)
				return session.capturePointCloud(request)
			},
			reset: () => session.reset(),
			resize: (viewport) => session.resize(viewport),
			dispose: () => session.dispose(),
			onOverload: ({ droppedStepCount }) => session.recordDroppedSteps(droppedStepCount),
			onError: options.onFailure,
		},
	})
	const backend = new MainThreadRuntime<ParameterSchema, unknown>(loop)
	await backend.initialize()
	await backend.resize(options.viewport)
	await backend.start()
	if (options.startPaused) await backend.pause()
	const publishAuthoritativeTelemetry = () => options.onMetrics(session.telemetry)
	return wrapBackend('main', backend, publishAuthoritativeTelemetry, publishAuthoritativeTelemetry)
}

export const createWorkerStudioController = async (options: CreateStudioControllerOptions): Promise<StudioController> => {
	if (options.rendererId !== 'canvas2d') throw new Error('Worker Studio runtime currently supports Canvas2D only.')
	const supportsWorker = options.plugin.executionProfiles.some(({ rendererId, runtimeId }) =>
		rendererId === 'canvas2d' && runtimeId === 'worker')
	if (!supportsWorker) throw new Error(`Experiment '${options.plugin.id}' does not support the Canvas2D worker profile.`)
	const offscreenCanvas = options.canvas.transferControlToOffscreen()
	const backend = new WorkerRuntime<ParameterSchema, unknown, {
		canvas: OffscreenCanvas
		experimentId: string
		viewport: Viewport
		parameters: StudioParameterValues
		formulaView: StudioFormulaView
		seed: string
	}>({
		createWorker: () => new Worker(new URL('./studio.worker.ts', import.meta.url), { type: 'module' }),
		initializePayload: {
			canvas: offscreenCanvas,
			experimentId: options.plugin.id,
			viewport: options.viewport,
			parameters: options.parameters,
			formulaView: options.formulaView,
			seed: options.seed,
		},
		initializeTransfer: [offscreenCanvas],
		onFailure: options.onFailure,
		onEvent: (event: RuntimeEvent) => {
			if (event.type !== 'telemetry' || typeof event.payload !== 'object' || event.payload === null) return
			const value = event.payload as Record<string, unknown>
			options.onMetrics({
				points: Number(value.points ?? 0),
				edges: Number(value.edges ?? 0),
				components: Number(value.components ?? 0),
				step: Number(value.step ?? 0),
				frameMs: Number(value.frameMs ?? 0),
				simulationMs: Number(value.simulationMs ?? 0),
				derivationMs: Number(value.derivationMs ?? 0),
				uploadMs: Number(value.uploadMs ?? 0),
				renderMs: Number(value.renderMs ?? 0),
				gpuRenderMs: Number(value.gpuRenderMs ?? 0),
				totalFrameMs: Number(value.totalFrameMs ?? value.frameMs ?? 0),
				droppedSteps: Number(value.droppedSteps ?? 0),
				searchBackend: value.searchBackend === 'grid' ? 'grid' : 'brute',
			})
		},
	})
	await backend.initialize()
	await backend.start()
	if (options.startPaused) await backend.pause()
	return wrapBackend('worker', backend)
}

const wrapBackend = (
	kind: StudioRuntimeKind,
	backend: ExecutionBackend<ParameterSchema, unknown>,
	afterPause?: () => void,
	afterStep?: () => void,
): StudioController => ({
	kind,
	get state() { return backend.state },
	pause: async () => {
		await backend.pause()
		afterPause?.()
	},
	resume: () => backend.resume(),
	step: async () => {
		await backend.step()
		afterStep?.()
	},
	updateFormulaView: (view) => backend.updateFormulaView(view),
	inspectPoint: (request) => backend.inspectPoint(request),
	capturePointCloud: (request) => backend.capturePointCloud(request),
	reset: () => backend.reset(),
	resize: (viewport) => backend.resize(viewport),
	applyInput: (input) => backend.applyInput(input),
	updateParameters: (patch) => backend.updateParameters(patch),
	dispose: () => backend.dispose(),
})
