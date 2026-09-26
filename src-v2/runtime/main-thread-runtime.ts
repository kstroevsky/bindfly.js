import type { ParameterPatch, ParameterSchema, Viewport } from '@bindfly-v2/core'

import type { ExecutionBackend } from './execution-backend.ts'
import type { FixedStepLoop } from './fixed-step-loop.ts'
import { assertRuntimeTransition } from './lifecycle.ts'
import type { RuntimeState } from './lifecycle.ts'
import type { RuntimeFormulaView, RuntimePointCloudCaptureRequest, RuntimePointInspectionRequest } from './protocol.ts'

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

	step(): Promise<void> {
		this.loop.stepOnce()
		return Promise.resolve()
	}

	updateFormulaView(view: RuntimeFormulaView): Promise<void> {
		this.loop.updateFormulaView(view)
		return Promise.resolve()
	}

	inspectPoint(request: RuntimePointInspectionRequest): Promise<unknown> {
		return Promise.resolve(this.loop.inspectPoint(request))
	}

	capturePointCloud(request: RuntimePointCloudCaptureRequest): Promise<unknown> {
		return Promise.resolve(this.loop.capturePointCloud(request))
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
		if (this.runtimeState === 'paused') this.loop.applyCurrentParameterEventsAndRender()
		return Promise.resolve()
	}

	reset(): Promise<void> {
		this.loop.reset()
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
