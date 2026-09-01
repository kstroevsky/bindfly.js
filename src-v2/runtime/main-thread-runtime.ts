import type { ParameterPatch, ParameterSchema, Viewport } from '@bindfly-v2/core'

import type { ExecutionBackend } from './execution-backend.ts'
import type { FixedStepLoop } from './fixed-step-loop.ts'
import { assertRuntimeTransition } from './lifecycle.ts'
import type { RuntimeState } from './lifecycle.ts'

export class MainThreadRuntime<Schema extends ParameterSchema, Input> implements ExecutionBackend<Schema, Input> {
	private readonly loop: FixedStepLoop<Input, ParameterPatch<Schema>>
	private runtimeState: RuntimeState = 'idle'

	constructor(loop: FixedStepLoop<Input, ParameterPatch<Schema>>) {
		this.loop = loop
	}

	get state(): RuntimeState {
		return this.runtimeState
	}

	private transition(to: RuntimeState): void {
		assertRuntimeTransition(this.runtimeState, to)
		this.runtimeState = to
	}

	initialize(): Promise<void> {
		this.transition('initializing')
		this.transition('ready')
		return Promise.resolve()
	}

	start(): Promise<void> {
		this.loop.start()
		this.transition('running')
		return Promise.resolve()
	}

	pause(): Promise<void> {
		this.loop.pause()
		this.transition('paused')
		return Promise.resolve()
	}

	resume(): Promise<void> {
		this.loop.resume()
		this.transition('running')
		return Promise.resolve()
	}

	resize(viewport: Viewport): Promise<void> {
		this.loop.resize(viewport)
		return Promise.resolve()
	}

	applyInput(input: Input): Promise<void> {
		this.loop.scheduleInput(input)
		return Promise.resolve()
	}

	updateParameters(patch: ParameterPatch<Schema>): Promise<void> {
		this.loop.scheduleParameterPatch(patch)
		return Promise.resolve()
	}

	dispose(): Promise<void> {
		if (this.runtimeState === 'disposed') return Promise.resolve()
		this.transition('disposing')
		this.loop.dispose()
		this.transition('disposed')
		return Promise.resolve()
	}
}
