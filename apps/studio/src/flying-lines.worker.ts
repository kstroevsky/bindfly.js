import { createProximityGraphWorkspace } from '../../../src-v2/analysis/proximity-graph.ts'
import { createUniformGridProximityGraphWorkspace, shouldUseUniformGrid } from '../../../src-v2/analysis/uniform-grid-proximity-graph.ts'
import { getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/parameters.ts'
import type { ParameterPatch } from '../../../src-v2/core/parameters.ts'
import { createSeededRandom } from '../../../src-v2/core/random.ts'
import type { Simulation } from '../../../src-v2/core/simulation.ts'
import { flyingLinesDefinition } from '../../../src-v2/effects/flying-lines/definition.ts'
import { applyFlyingLinesHotParameters } from '../../../src-v2/effects/flying-lines/parameter-update.ts'
import { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import type { FlyingLinesInput, FlyingLinesState } from '../../../src-v2/effects/flying-lines/types.ts'
import { createFlyingLinesCanvasRenderer } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
import type { FlyingLinesRenderView } from '../../../src-v2/rendering/canvas2d/flying-lines-renderer.ts'
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
	let parameters = payload.parameters
	let viewport = payload.viewport
	let simulation: Simulation<FlyingLinesState, FlyingLinesInput> = flyingLinesDefinition.createSimulation({
		random: createSeededRandom(payload.seed),
		viewport,
	}, parameters)
	const renderer = createFlyingLinesCanvasRenderer(payload.canvas)
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
		simulation = flyingLinesDefinition.createSimulation({ random: createSeededRandom(payload.seed), viewport }, parameters)
		refreshDerivedOwners()
	}

	loop = new FixedStepLoop({
		clock: new FixedStepClock({ stepSeconds: flyingLinesDefinition.timing.fixedStepSeconds, maxCatchUpSteps: 8 }),
		scheduler,
		callbacks: {
			step: (step) => simulation.step(step),
			render: (frame) => {
				const startedAt = performance.now()
				workspace.analyze(simulation.state.particles, simulation.state.connectionRadius)
				renderer.render(view, frame)
				if (frame.frameIndex % 6 === 0) scope.postMessage(runtimeEvent({
					type: 'telemetry',
					payload: {
						points: simulation.state.particles.count,
						edges: workspace.result.edgeCount,
						components: workspace.result.componentCount,
						step: frame.simulationStepIndex,
						frameMs: performance.now() - startedAt,
						droppedSteps,
						searchBackend: workspace === grid ? 'grid' : 'brute',
					},
				}))
			},
			applyInput: (input) => simulation.applyInput(input),
			applyParameterPatch: (patch) => {
				const invalidation = getParameterPatchInvalidation(flyingLinesParameters, patch)
				const normalized = normalizeParameters(flyingLinesParameters, { ...parameters, ...patch })
				if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid worker parameter patch.')
				parameters = normalized.value
				if (invalidation === 'hot-update') {
					applyFlyingLinesHotParameters(simulation.state, parameters)
					refreshDerivedOwners()
				} else if (invalidation === 'reset-simulation') rebuild()
				else throw new Error('Flying Lines requires a runtime rebuild for this parameter patch.')
			},
			reset: () => { droppedSteps = 0; simulation.reset() },
			resize: (nextViewport) => {
				viewport = nextViewport
				renderer.resize(viewport)
				simulation.resize(viewport)
			},
			dispose: () => { simulation.dispose(); renderer.dispose() },
			onOverload: ({ droppedStepCount }) => { droppedSteps += droppedStepCount },
			onError: (error) => scope.postMessage(runtimeEvent({
				type: 'error',
				error: { code: 'WORKER_LOOP_FAILED', message: error instanceof Error ? error.message : 'Worker loop failed.', recoverable: false },
			})),
		},
	})
	loop.resize(viewport)
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
