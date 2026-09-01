import type { ParameterPatch, ParameterSchema, Viewport } from '@bindfly-v2/core'

import type { ExecutionBackend } from './execution-backend.ts'
import { assertRuntimeTransition } from './lifecycle.ts'
import type { RuntimeState } from './lifecycle.ts'
import { RUNTIME_PROTOCOL_VERSION, createRuntimeCommand, isRuntimeEvent } from './protocol.ts'
import type { RuntimeCommandType, RuntimeErrorPayload, RuntimeEvent } from './protocol.ts'

export interface WorkerTransport {
	postMessage(message: unknown, transfer?: Transferable[]): void
	addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
	addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
	removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
	removeEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
	terminate(): void
}

export class RuntimeRemoteError extends Error {
	readonly code: string
	readonly recoverable: boolean

	constructor(error: RuntimeErrorPayload) {
		super(error.message)
		this.name = 'RuntimeRemoteError'
		this.code = error.code
		this.recoverable = error.recoverable
	}
}

export interface WorkerRuntimeOptions<InitializePayload> {
	readonly createWorker: () => WorkerTransport
	readonly initializePayload: InitializePayload
	readonly initializeTransfer?: Transferable[]
	readonly onEvent?: (event: RuntimeEvent) => void
	readonly onFailure?: (error: unknown) => void
}

export class WorkerRuntime<Schema extends ParameterSchema, Input, InitializePayload>
	implements ExecutionBackend<Schema, Input> {
	private readonly options: WorkerRuntimeOptions<InitializePayload>
	private runtimeState: RuntimeState = 'idle'
	private worker: WorkerTransport | undefined
	private sequence = 0
	private requestCounter = 0
	private commandChain: Promise<void> = Promise.resolve()
	private readonly pending = new Map<string, { resolve: () => void; reject: (error: unknown) => void }>()
	private transferred = false

	constructor(options: WorkerRuntimeOptions<InitializePayload>) {
		this.options = options
	}

	get state(): RuntimeState {
		return this.runtimeState
	}

	get needsCanvasRemount(): boolean {
		return this.transferred
	}

	private transition(to: RuntimeState): void {
		assertRuntimeTransition(this.runtimeState, to)
		this.runtimeState = to
	}

	private readonly onMessage = (event: MessageEvent<unknown>): void => {
		if (!isRuntimeEvent(event.data)) return
		const runtimeEvent = event.data
		this.options.onEvent?.(runtimeEvent)
		if (runtimeEvent.type === 'ready' || runtimeEvent.type === 'ack') {
			const pending = this.pending.get(runtimeEvent.requestId)
			if (!pending) return
			this.pending.delete(runtimeEvent.requestId)
			pending.resolve()
			return
		}
		if (runtimeEvent.type === 'error') {
			const error = new RuntimeRemoteError(runtimeEvent.error)
			if (runtimeEvent.requestId) {
				const pending = this.pending.get(runtimeEvent.requestId)
				this.pending.delete(runtimeEvent.requestId)
				pending?.reject(error)
			}
			this.fail(error)
		}
	}

	private readonly onError = (event: ErrorEvent): void => {
		this.fail(new Error(event.message || 'Worker runtime failed.'))
	}

	private fail(error: unknown): void {
		if (this.runtimeState !== 'failed' && this.runtimeState !== 'disposed' && this.runtimeState !== 'disposing') {
			this.transition('failed')
		}
		for (const pending of this.pending.values()) pending.reject(error)
		this.pending.clear()
		this.cleanupWorker()
		this.options.onFailure?.(error)
	}

	private cleanupWorker(): void {
		if (!this.worker) return
		this.worker.removeEventListener('message', this.onMessage)
		this.worker.removeEventListener('error', this.onError)
		this.worker.terminate()
		this.worker = undefined
	}

	private dispatch(type: RuntimeCommandType, payload: unknown, transfer?: Transferable[]): Promise<void> {
		if (!this.worker) return Promise.reject(new Error('Worker runtime is not initialized.'))
		const requestId = `runtime-${this.requestCounter++}`
		const command = createRuntimeCommand({ requestId, sequence: this.sequence++, type, payload })
		return new Promise<void>((resolve, reject) => {
			this.pending.set(requestId, { resolve, reject })
			this.worker?.postMessage(command, transfer)
		})
	}

	private enqueue(type: RuntimeCommandType, payload: unknown): Promise<void> {
		const operation = this.commandChain.then(() => this.dispatch(type, payload))
		this.commandChain = operation.catch(() => {})
		return operation
	}

	async initialize(): Promise<void> {
		this.transition('initializing')
		this.worker = this.options.createWorker()
		this.worker.addEventListener('message', this.onMessage)
		this.worker.addEventListener('error', this.onError)
		const transfer = this.options.initializeTransfer ?? []
		this.transferred = transfer.length > 0
		await this.dispatch('initialize', this.options.initializePayload, transfer)
		this.transition('ready')
	}

	async start(): Promise<void> {
		await this.enqueue('resume', undefined)
		this.transition('running')
	}

	async pause(): Promise<void> {
		await this.enqueue('pause', undefined)
		this.transition('paused')
	}

	async resume(): Promise<void> {
		await this.enqueue('resume', undefined)
		this.transition('running')
	}

	resize(viewport: Viewport): Promise<void> {
		return this.enqueue('resize', viewport)
	}

	applyInput(input: Input): Promise<void> {
		return this.enqueue('input', input)
	}

	updateParameters(patch: ParameterPatch<Schema>): Promise<void> {
		return this.enqueue('parameters', patch)
	}

	async dispose(): Promise<void> {
		if (this.runtimeState === 'disposed') return
		this.transition('disposing')
		try {
			if (this.worker) await this.enqueue('dispose', undefined)
		} finally {
			this.cleanupWorker()
			this.pending.clear()
			this.transition('disposed')
		}
	}
}

export interface WorkerCanvasCapability {
	readonly supported: boolean
	readonly reason?: string
}

export const probeWorkerCanvasSupport = (canvas: HTMLCanvasElement): WorkerCanvasCapability => {
	if (typeof Worker === 'undefined') return { supported: false, reason: 'Worker is unavailable.' }
	if (typeof OffscreenCanvas === 'undefined') return { supported: false, reason: 'OffscreenCanvas is unavailable.' }
	if (typeof canvas.transferControlToOffscreen !== 'function') {
		return { supported: false, reason: 'Canvas transfer is unavailable.' }
	}
	return { supported: true }
}

type RuntimeEventWithoutVersion = RuntimeEvent extends infer Event
	? Event extends RuntimeEvent ? Omit<Event, 'protocolVersion'> : never
	: never

export const runtimeEvent = (event: RuntimeEventWithoutVersion): RuntimeEvent => ({
	...event,
	protocolVersion: RUNTIME_PROTOCOL_VERSION,
} as RuntimeEvent)
