import { createProximityGraphWorkspace, createUniformGridProximityGraphWorkspace, shouldUseUniformGrid } from '../../../src-v2/analysis/index.ts'
import { createSeededRandom, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, ParameterValues, Simulation, Viewport } from '../../../src-v2/core/index.ts'
import { flyingLinesDefinition, flyingLinesParameters } from '../../../src-v2/effects/index.ts'
import type { FlyingLinesInput, FlyingLinesState } from '../../../src-v2/effects/index.ts'
import { createFlyingLinesCanvasRenderer } from '../../../src-v2/rendering/index.ts'
import type { FlyingLinesRenderView } from '../../../src-v2/rendering/index.ts'
import { FixedStepClock, FixedStepLoop, isRuntimeCommand, runtimeEvent } from '../../../src-v2/runtime/index.ts'
import type { AnimationFrameScheduler, RuntimeCommand } from '../../../src-v2/runtime/index.ts'

interface InitializePayload {
	readonly canvas: OffscreenCanvas
	readonly viewport: Viewport
	readonly parameters: ParameterValues<typeof flyingLinesParameters>
	readonly seed: string
}

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

const initialize = (payload: InitializePayload) => {
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

	const rebuild = () => {
		simulation.dispose()
		simulation = flyingLinesDefinition.createSimulation({ random: createSeededRandom(payload.seed), viewport }, parameters)
		workspace = shouldUseUniformGrid(simulation.state.particles, simulation.state.connectionRadius) ? grid : brute
		view = { background: simulation.state.background, particles: simulation.state.particles, edges: workspace.result }
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
						searchBackend: workspace === grid ? 'grid' : 'brute',
					},
				}))
			},
			applyInput: (input) => simulation.applyInput(input),
			applyParameterPatch: (patch) => {
				const normalized = normalizeParameters(flyingLinesParameters, { ...parameters, ...patch })
				if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid worker parameter patch.')
				parameters = normalized.value
				rebuild()
			},
			reset: () => simulation.reset(),
			resize: (nextViewport) => {
				viewport = nextViewport
				renderer.resize(viewport)
				simulation.resize(viewport)
			},
			dispose: () => { simulation.dispose(); renderer.dispose() },
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
	if (command.sequence !== expectedSequence++) {
		reject(command.requestId, 'OUT_OF_ORDER', `Expected sequence ${expectedSequence - 1}, received ${command.sequence}.`, false)
		return
	}

	try {
		switch (command.type) {
			case 'initialize':
				if (loop) throw new Error('Worker is already initialized.')
				initialize(command.payload as InitializePayload)
				scope.postMessage(runtimeEvent({ type: 'ready', requestId: command.requestId }))
				break
			case 'resize':
				loop?.resize(command.payload as Viewport)
				acknowledge(command.requestId)
				break
			case 'input':
				loop?.scheduleInput(command.payload as FlyingLinesInput)
				acknowledge(command.requestId)
				break
			case 'parameters':
				loop?.scheduleParameterPatch(command.payload as ParameterPatch<typeof flyingLinesParameters>)
				acknowledge(command.requestId)
				break
			case 'pause':
				loop?.pause()
				acknowledge(command.requestId)
				break
			case 'resume':
				loop?.resume()
				acknowledge(command.requestId)
				break
			case 'dispose':
				loop?.dispose()
				acknowledge(command.requestId)
				scope.postMessage(runtimeEvent({ type: 'disposed' }))
				self.setTimeout(() => scope.close(), 0)
				break
		}
	} catch (error) {
		reject(command.requestId, 'COMMAND_FAILED', error instanceof Error ? error.message : 'Worker command failed.', false)
	}
}
