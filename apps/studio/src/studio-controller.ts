import type { ParameterPatch, ParameterValues } from '../../../src-v2/core/parameters.ts'
import type { Viewport } from '../../../src-v2/core/viewport.ts'
import { flyingLinesDefinition } from '../../../src-v2/effects/flying-lines/definition.ts'
import type { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import type { FlyingLinesInput } from '../../../src-v2/effects/flying-lines/types.ts'
import type { ExecutionBackend } from '../../../src-v2/runtime/execution-backend.ts'
import { FixedStepClock } from '../../../src-v2/runtime/fixed-step-clock.ts'
import { browserAnimationFrameScheduler, FixedStepLoop } from '../../../src-v2/runtime/fixed-step-loop.ts'
import type { RuntimeState } from '../../../src-v2/runtime/lifecycle.ts'
import { MainThreadRuntime } from '../../../src-v2/runtime/main-thread-runtime.ts'
import type { RuntimeEvent } from '../../../src-v2/runtime/protocol.ts'
import { WorkerRuntime } from '../../../src-v2/runtime/worker-runtime.ts'
import type { ExperimentTelemetry } from './experiment-session.ts'
import { createFlyingLinesSession } from './flying-lines-session.ts'

export type StudioRuntimeKind = 'main' | 'worker'
export type StudioMetrics = ExperimentTelemetry

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
	const session = createFlyingLinesSession(options)
	const loop = new FixedStepLoop<FlyingLinesInput, ParameterPatch<typeof flyingLinesParameters>>({
		clock: new FixedStepClock({
			stepSeconds: flyingLinesDefinition.timing.fixedStepSeconds,
			maxCatchUpSteps: 8,
		}),
		scheduler: browserAnimationFrameScheduler,
		callbacks: {
			step: (step) => session.step(step),
			render: (frame) => {
				const telemetry = session.render(frame)
				if (frame.frameIndex % 6 === 0) options.onMetrics(telemetry)
			},
			applyInput: (input) => session.applyInput(input),
			applyParameterPatch: (patch) => session.updateParameters(patch),
			reset: () => session.reset(),
			resize: (viewport) => session.resize(viewport),
			dispose: () => session.dispose(),
			onOverload: ({ droppedStepCount }) => session.recordDroppedSteps(droppedStepCount),
			onError: options.onFailure,
		},
	})
	const backend = new MainThreadRuntime<typeof flyingLinesParameters, FlyingLinesInput>(loop)
	await backend.initialize()
	await backend.resize(options.viewport)
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
		initializePayload: {
			canvas: offscreenCanvas,
			viewport: options.viewport,
			parameters: options.parameters,
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
				droppedSteps: Number(value.droppedSteps ?? 0),
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
	pause: () => backend.pause(),
	resume: () => backend.resume(),
	reset: () => backend.reset(),
	resize: (viewport) => backend.resize(viewport),
	applyInput: (input) => backend.applyInput(input),
	updateParameters: (patch) => backend.updateParameters(patch),
	dispose: () => backend.dispose(),
})
