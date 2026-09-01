import assert from 'node:assert/strict'
import test from 'node:test'

import type {
	AnalysisSnapshot,
	AnalyzerDefinition,
	ExperimentStateCodec,
	Simulation,
	SimulationStep,
	Viewport,
} from '../core/index.ts'
import {
	createExperimentRegistry,
	createSeededRandom,
	createViewport,
	defineExperiment,
	defineParameterSchema,
	normalizeParameters,
} from '../core/index.ts'
import type { ExecutionBackend } from '../runtime/execution-backend.ts'
import type { RuntimeState } from '../runtime/lifecycle.ts'
import { assertRuntimeTransition } from '../runtime/lifecycle.ts'

const schema = defineParameterSchema({
	speed: {
		kind: 'number',
		default: 1,
		min: 0,
		max: 10,
		step: 0.5,
		invalidation: 'hot-update',
	},
})

interface FakeState {
	ticks: number
}

interface DurableState {
	parameters: { readonly speed: number }
	seed: string
}

class FakeSimulation implements Simulation<FakeState, { readonly type: 'nudge' }> {
	readonly state: FakeState = { ticks: 0 }

	step(_frame: SimulationStep): void {
		this.state.ticks++
	}

	applyInput(input: { readonly type: 'nudge' }): void {
		if (input.type === 'nudge') this.state.ticks++
	}

	resize(_viewport: Viewport): void {}

	reset(): void {
		this.state.ticks = 0
	}

	dispose(): void {}
}

const codec: ExperimentStateCodec<DurableState, string> = {
	currentVersion: 1,
	serialize: (state) => JSON.stringify(state),
	parse: (serialized) => {
		if (typeof serialized !== 'string') return { ok: false, error: 'serialized state must be a string' }
		return { ok: true, value: JSON.parse(serialized) as DurableState }
	},
	migrate: (serialized, context) => context.fromVersion === context.toVersion
		? { ok: true, value: serialized }
		: { ok: false, error: 'fake codec has no migration' },
}

const analyzer: AnalyzerDefinition<FakeState, number> = {
	id: 'tick-count',
	analyze: (snapshot, _context, signal) => {
		if (signal.aborted) return Promise.reject(signal.reason)
		return {
			value: snapshot.state.ticks,
			provenance: {
				snapshotId: snapshot.snapshotId,
				experimentId: snapshot.experimentId,
				stateVersion: snapshot.stateVersion,
				simulationStepIndex: snapshot.simulationStepIndex,
				backendId: 'fake',
				backendVersion: '1',
				durationMs: 0,
				sampledItemCount: 1,
				inputItemCount: 1,
				warnings: [],
			},
		}
	},
}

const definition = defineExperiment<
	typeof schema,
	FakeState,
	{ readonly type: 'nudge' },
	DurableState,
	string
>({
	id: 'fake-experiment',
	stateVersion: 1,
	timing: {
		fixedStepSeconds: 1 / 60,
		deterministicTier: 'same-build-cpu',
		stateTolerance: 0,
	},
	parameters: schema,
	stateCodec: codec,
	capabilities: {
		renderers: ['canvas2d'],
		runtimes: ['main-thread', 'worker'],
		snapshotState: (state) => ({ ...state }),
	},
	analyzers: [analyzer],
	createSimulation: () => new FakeSimulation(),
})

class FakeExecutionBackend implements ExecutionBackend<typeof schema, { readonly type: 'nudge' }> {
	state: RuntimeState = 'idle'
	lastViewport: Viewport | undefined
	lastSpeed: number | undefined
	inputCount = 0

	private transition(to: RuntimeState): void {
		assertRuntimeTransition(this.state, to)
		this.state = to
	}

	initialize(): Promise<void> {
		this.transition('initializing')
		this.transition('ready')
		return Promise.resolve()
	}

	start(): Promise<void> {
		this.transition('running')
		return Promise.resolve()
	}

	pause(): Promise<void> {
		this.transition('paused')
		return Promise.resolve()
	}

	resume(): Promise<void> {
		this.transition('running')
		return Promise.resolve()
	}

	resize(viewport: Viewport): Promise<void> {
		this.lastViewport = viewport
		return Promise.resolve()
	}

	applyInput(_input: { readonly type: 'nudge' }): Promise<void> {
		this.inputCount++
		return Promise.resolve()
	}

	updateParameters(patch: { readonly speed?: number }): Promise<void> {
		this.lastSpeed = patch.speed
		return Promise.resolve()
	}

	reset(): Promise<void> {
		return Promise.resolve()
	}

	dispose(): Promise<void> {
		this.transition('disposing')
		this.transition('disposed')
		return Promise.resolve()
	}
}

test('fake experiment proves registry, serialization and analyzer cancellation contracts', async () => {
	const registry = createExperimentRegistry<typeof definition>()
	registry.register({
		id: definition.id,
		load: () => Promise.resolve({ default: definition }),
	})

	const loaded = await registry.load('fake-experiment')
	const normalized = normalizeParameters(loaded.parameters, {})
	assert.equal(normalized.ok, true)
	if (!normalized.ok) return

	const durable: DurableState = {
		parameters: normalized.value,
		seed: 'fixture',
	}
	const serialized = loaded.stateCodec.serialize(durable)
	assert.deepEqual(loaded.stateCodec.parse(serialized), { ok: true, value: durable })

	const simulation = loaded.createSimulation(
		{
			random: createSeededRandom(durable.seed),
			viewport: createViewport({ cssWidth: 320, cssHeight: 200, devicePixelRatio: 2 }),
		},
		normalized.value,
	)
	simulation.step({ index: 0, dtSeconds: 1 / 60, elapsedSeconds: 1 / 60 })
	assert.equal(simulation.state.ticks, 1)

	const snapshot: AnalysisSnapshot<FakeState> = {
		snapshotId: 'snapshot-1',
		experimentId: loaded.id,
		stateVersion: loaded.stateVersion,
		simulationStepIndex: 1,
		simulationTimeSeconds: 1 / 60,
		state: { ...simulation.state },
	}
	const controller = new AbortController()
	controller.abort(new Error('cancelled'))
	await assert.rejects(
		() => Promise.resolve(analyzer.analyze(snapshot, { requestedAtMs: 0 }, controller.signal)),
		/cancelled/,
	)
})

test('fake backend proves the complete lifecycle surface', async () => {
	const backend = new FakeExecutionBackend()
	const viewport = createViewport({ cssWidth: 640, cssHeight: 480, devicePixelRatio: 1 })

	await backend.initialize()
	await backend.start()
	await backend.pause()
	await backend.resume()
	await backend.resize(viewport)
	await backend.updateParameters({ speed: 2 })
	await backend.applyInput({ type: 'nudge' })
	await backend.reset()
	await backend.dispose()

	assert.equal(backend.state, 'disposed')
	assert.deepEqual(backend.lastViewport, viewport)
	assert.equal(backend.lastSpeed, 2)
	assert.equal(backend.inputCount, 1)
})

test('experiment definitions reject invalid identity and codec versions', () => {
	assert.throws(
		() => defineExperiment({ ...definition, id: '' }),
		/non-empty stable ID/,
	)
	assert.throws(
		() => defineExperiment({
			...definition,
			stateVersion: 2,
		}),
		/codec version 1 does not match stateVersion 2/,
	)
	assert.throws(
		() => defineExperiment({ ...definition, analyzers: [analyzer, analyzer] }),
		/duplicate analyzer IDs/,
	)
	assert.throws(
		() => defineExperiment({
			...definition,
			timing: { ...definition.timing, fixedStepSeconds: 0 },
		}),
		/fixedStepSeconds must be a positive finite number/,
	)
	assert.throws(
		() => defineExperiment({
			...definition,
			presets: [
				{ id: 'same', name: 'One', parameters: { speed: 1 } },
				{ id: 'same', name: 'Two', parameters: { speed: 2 } },
			],
		}),
		/duplicate preset IDs/,
	)
})
