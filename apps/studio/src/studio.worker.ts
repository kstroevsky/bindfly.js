import type { ParameterSchema } from '../../../src-v2/core/parameters.ts'
import { FixedStepClock } from '../../../src-v2/runtime/fixed-step-clock.ts'
import { FixedStepLoop } from '../../../src-v2/runtime/fixed-step-loop.ts'
import type { AnimationFrameScheduler } from '../../../src-v2/runtime/fixed-step-loop.ts'
import { isRuntimeCommand, isRuntimeFormulaView, isRuntimePointCloudCaptureRequest, isRuntimePointInspectionRequest } from '../../../src-v2/runtime/protocol.ts'
import type { RuntimeCommand } from '../../../src-v2/runtime/protocol.ts'
import { runtimeEvent } from '../../../src-v2/runtime/worker-runtime.ts'
import type { ErasedExperimentSession, StudioExperimentPlugin, StudioParameterPatch } from './studio-experiment-plugin.ts'
import { studioExperimentRegistry } from './studio-experiment-registry.ts'
import { parseStudioWorkerInitializePayload, parseStudioWorkerViewport } from './studio-worker-validation.ts'

interface WorkerScope {
	postMessage(message: unknown): void
	close(): void
	requestAnimationFrame?: (callback: (timestamp: number) => void) => number
	cancelAnimationFrame?: (id: number) => void
}

const scope = self as unknown as WorkerScope
const scheduler: AnimationFrameScheduler = {
	request: (callback) => scope.requestAnimationFrame
		? scope.requestAnimationFrame(callback)
		: self.setTimeout(() => callback(performance.now()), 1000 / 60),
	cancel: (id) => scope.cancelAnimationFrame ? scope.cancelAnimationFrame(id) : self.clearTimeout(id),
}

let expectedSequence = 0
let plugin: StudioExperimentPlugin | undefined
let session: ErasedExperimentSession | undefined
let loop: FixedStepLoop<unknown, StudioParameterPatch> | undefined

const initialize = async (value: unknown) => {
	const payload = parseStudioWorkerInitializePayload(value)
	plugin = await studioExperimentRegistry.load(payload.experimentId)
	const supportsWorker = plugin.executionProfiles.some(({ rendererId, runtimeId }) =>
		rendererId === 'canvas2d' && runtimeId === 'worker')
	if (!supportsWorker) throw new Error(`Experiment '${plugin.id}' does not support the Canvas2D worker profile.`)
	session = plugin.createSession(payload)
	loop = new FixedStepLoop<unknown, StudioParameterPatch>({
		clock: new FixedStepClock({ stepSeconds: plugin.timing.fixedStepSeconds, maxCatchUpSteps: 8 }),
		scheduler,
		callbacks: {
			step: (step) => session?.step(step),
			render: (frame) => {
				const telemetry = session?.render(frame)
				if (telemetry && frame.frameIndex % 6 === 0) {
					scope.postMessage(runtimeEvent({ type: 'telemetry', payload: telemetry }))
				}
			},
			applyInput: (input) => session?.applyInput(input),
			applyParameterPatch: (patch) => session?.updateParameters(patch),
			updateFormulaView: (view) => session?.updateFormulaView?.(view),
			inspectPoint: (request) => {
				if (!session?.inspectPoint) throw new Error(`Experiment '${plugin?.id ?? 'unknown'}' does not support point inspection.`)
				return session.inspectPoint(request)
			},
			capturePointCloud: (request) => {
				if (!session?.capturePointCloud) throw new Error(`Experiment '${plugin?.id ?? 'unknown'}' does not support point-cloud capture.`)
				return session.capturePointCloud(request)
			},
			reset: () => session?.reset(),
			resize: (viewport) => session?.resize(viewport),
			dispose: () => session?.dispose(),
			onOverload: ({ droppedStepCount }) => session?.recordDroppedSteps(droppedStepCount),
			onError: (error) => scope.postMessage(runtimeEvent({
				type: 'error',
				error: { code: 'WORKER_LOOP_FAILED', message: error instanceof Error ? error.message : 'Worker loop failed.', recoverable: false },
			})),
		},
	})
	loop.resize(payload.viewport)
}

const acknowledge = (requestId: string) => scope.postMessage(runtimeEvent({ type: 'ack', requestId }))
const reject = (requestId: string | undefined, code: string, message: string) =>
	scope.postMessage(runtimeEvent(requestId
		? { type: 'error', requestId, error: { code, message, recoverable: false } }
		: { type: 'error', error: { code, message, recoverable: false } }))

const requireReady = () => {
	if (!loop || !plugin || !session) throw new Error('Worker is not initialized.')
	return { loop, plugin }
}

const handleCommand = async (command: RuntimeCommand): Promise<void> => {
	switch (command.type) {
		case 'initialize':
			if (loop) throw new Error('Worker is already initialized.')
			await initialize(command.payload)
			scope.postMessage(runtimeEvent({ type: 'ready', requestId: command.requestId }))
			break
		case 'resize':
			requireReady().loop.resize(parseStudioWorkerViewport(command.payload))
			acknowledge(command.requestId)
			break
		case 'input': {
			const ready = requireReady()
			const parsed = ready.plugin.parseInput(command.payload)
			if (!parsed.ok) throw new Error(parsed.error)
			ready.loop.scheduleInput(parsed.value)
			acknowledge(command.requestId)
			break
		}
		case 'parameters': {
			const ready = requireReady()
			const parsed = ready.plugin.parseParameterPatch(command.payload)
			if (!parsed.ok) throw new Error(parsed.error)
			ready.loop.scheduleParameterPatch(parsed.value)
			if (ready.loop.state === 'paused') ready.loop.applyCurrentParameterEventsAndRender()
			acknowledge(command.requestId)
			break
		}
		case 'reset':
			requireReady().loop.reset()
			acknowledge(command.requestId)
			break
		case 'pause': {
			requireReady().loop.pause()
			if (session) scope.postMessage(runtimeEvent({ type: 'telemetry', payload: session.telemetry }))
			acknowledge(command.requestId)
			break
		}
		case 'resume':
			requireReady().loop.resume()
			acknowledge(command.requestId)
			break
		case 'step':
			requireReady().loop.stepOnce()
			if (session) scope.postMessage(runtimeEvent({ type: 'telemetry', payload: session.telemetry }))
			acknowledge(command.requestId)
			break
		case 'formula-view': {
			if (!isRuntimeFormulaView(command.payload)) throw new Error('Formula-view presentation update is invalid.')
			const ready = requireReady()
			if (!ready.plugin.formulaViews.includes(command.payload)) throw new Error(`Formula view '${command.payload}' is unsupported by '${ready.plugin.id}'.`)
			ready.loop.updateFormulaView(command.payload)
			acknowledge(command.requestId)
			break
		}
		case 'inspect-point': {
			if (!isRuntimePointInspectionRequest(command.payload)) throw new Error('Point inspection request is invalid.')
			const payload = requireReady().loop.inspectPoint(command.payload)
			scope.postMessage(runtimeEvent({ type: 'inspection-result', requestId: command.requestId, payload }))
			break
		}
		case 'capture-point-cloud': {
			if (!isRuntimePointCloudCaptureRequest(command.payload)) throw new Error('Point-cloud capture request is invalid.')
			const payload = requireReady().loop.capturePointCloud(command.payload)
			scope.postMessage(runtimeEvent({ type: 'point-cloud-snapshot', requestId: command.requestId, payload }))
			break
		}
		case 'dispose':
			requireReady().loop.dispose()
			acknowledge(command.requestId)
			scope.postMessage(runtimeEvent({ type: 'disposed' }))
			self.setTimeout(() => scope.close(), 0)
			break
	}
}

self.onmessage = (event: MessageEvent<unknown>) => {
	if (!isRuntimeCommand(event.data)) {
		reject(undefined, 'INVALID_COMMAND', 'Worker received an invalid runtime command.')
		return
	}
	const command: RuntimeCommand = event.data
	if (command.sequence !== expectedSequence) {
		reject(command.requestId, 'OUT_OF_ORDER', `Expected sequence ${expectedSequence}, received ${command.sequence}.`)
		return
	}
	expectedSequence += 1
	void handleCommand(command).catch((error: unknown) => {
		reject(command.requestId, 'COMMAND_FAILED', error instanceof Error ? error.message : 'Worker command failed.')
	})
}

export type StudioWorkerSchema = ParameterSchema
