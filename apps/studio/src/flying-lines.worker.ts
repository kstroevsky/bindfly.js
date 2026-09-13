import type { ParameterPatch } from '../../../src-v2/core/parameters.ts'
import { flyingLinesDefinition } from '../../../src-v2/effects/flying-lines/definition.ts'
import type { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import type { FlyingLinesInput } from '../../../src-v2/effects/flying-lines/types.ts'
import { FixedStepClock } from '../../../src-v2/runtime/fixed-step-clock.ts'
import { FixedStepLoop } from '../../../src-v2/runtime/fixed-step-loop.ts'
import type { AnimationFrameScheduler } from '../../../src-v2/runtime/fixed-step-loop.ts'
import { isRuntimeCommand } from '../../../src-v2/runtime/protocol.ts'
import type { RuntimeCommand } from '../../../src-v2/runtime/protocol.ts'
import { runtimeEvent } from '../../../src-v2/runtime/worker-runtime.ts'
import {
	parseFlyingLinesWorkerInitializePayload,
	parseFlyingLinesWorkerInput,
	parseFlyingLinesWorkerParameterPatch,
	parseFlyingLinesWorkerViewport,
} from './flying-lines-worker-validation.ts'
import type { FlyingLinesWorkerInitializePayload } from './flying-lines-worker-validation.ts'
import { createFlyingLinesSession } from './flying-lines-session.ts'

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
let loop: FixedStepLoop<FlyingLinesInput, ParameterPatch<typeof flyingLinesParameters>> | undefined

const initialize = (payload: FlyingLinesWorkerInitializePayload) => {
	const session = createFlyingLinesSession(payload)

	loop = new FixedStepLoop({
		clock: new FixedStepClock({ stepSeconds: flyingLinesDefinition.timing.fixedStepSeconds, maxCatchUpSteps: 8 }),
		scheduler,
		callbacks: {
			step: (step) => session.step(step),
			render: (frame) => {
				const telemetry = session.render(frame)
				if (frame.frameIndex % 6 === 0) scope.postMessage(runtimeEvent({
					type: 'telemetry',
					payload: telemetry,
				}))
			},
			applyInput: (input) => session.applyInput(input),
			applyParameterPatch: (patch) => session.updateParameters(patch),
			reset: () => session.reset(),
			resize: (viewport) => session.resize(viewport),
			dispose: () => session.dispose(),
			onOverload: ({ droppedStepCount }) => session.recordDroppedSteps(droppedStepCount),
			onError: (error) => scope.postMessage(runtimeEvent({
				type: 'error',
				error: { code: 'WORKER_LOOP_FAILED', message: error instanceof Error ? error.message : 'Worker loop failed.', recoverable: false },
			})),
		},
	})
	loop.resize(payload.viewport)
}

const acknowledge = (requestId: string) => scope.postMessage(runtimeEvent({ type: 'ack', requestId }))
const reject = (requestId: string | undefined, code: string, message: string, recoverable: boolean) =>
	scope.postMessage(runtimeEvent(requestId
		? { type: 'error', requestId, error: { code, message, recoverable } }
		: { type: 'error', error: { code, message, recoverable } }))

self.onmessage = (event: MessageEvent<unknown>) => {
	if (!isRuntimeCommand(event.data)) {
		reject(undefined, 'INVALID_COMMAND', 'Worker received an invalid runtime command.', false)
		return
	}
	const command: RuntimeCommand = event.data
	if (command.sequence !== expectedSequence) {
		reject(command.requestId, 'OUT_OF_ORDER', `Expected sequence ${expectedSequence}, received ${command.sequence}.`, false)
		return
	}
	expectedSequence += 1

	try {
		switch (command.type) {
			case 'initialize':
				if (loop) throw new Error('Worker is already initialized.')
				initialize(parseFlyingLinesWorkerInitializePayload(command.payload))
				scope.postMessage(runtimeEvent({ type: 'ready', requestId: command.requestId }))
				break
			case 'resize':
				if (!loop) throw new Error('Worker is not initialized.')
				loop.resize(parseFlyingLinesWorkerViewport(command.payload))
				acknowledge(command.requestId)
				break
			case 'input':
				if (!loop) throw new Error('Worker is not initialized.')
				loop.scheduleInput(parseFlyingLinesWorkerInput(command.payload))
				acknowledge(command.requestId)
				break
			case 'parameters':
				if (!loop) throw new Error('Worker is not initialized.')
				loop.scheduleParameterPatch(parseFlyingLinesWorkerParameterPatch(command.payload))
				acknowledge(command.requestId)
				break
			case 'reset':
				if (!loop) throw new Error('Worker is not initialized.')
				loop.reset()
				acknowledge(command.requestId)
				break
			case 'pause':
				if (!loop) throw new Error('Worker is not initialized.')
				loop.pause()
				acknowledge(command.requestId)
				break
			case 'resume':
				if (!loop) throw new Error('Worker is not initialized.')
				loop.resume()
				acknowledge(command.requestId)
				break
			case 'dispose':
				if (!loop) throw new Error('Worker is not initialized.')
				loop.dispose()
				acknowledge(command.requestId)
				scope.postMessage(runtimeEvent({ type: 'disposed' }))
				self.setTimeout(() => scope.close(), 0)
				break
		}
	} catch (error) {
		reject(command.requestId, 'INVALID_PAYLOAD', error instanceof Error ? error.message : 'Worker command failed.', false)
	}
}
