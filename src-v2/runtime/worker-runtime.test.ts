import assert from 'node:assert/strict'
import test from 'node:test'

import { defineParameterSchema } from '../core/index.ts'
import { RUNTIME_PROTOCOL_VERSION } from './protocol.ts'
import type { RuntimeCommand } from './protocol.ts'
import { RuntimeRemoteError, WorkerRuntime } from './worker-runtime.ts'
import type { WorkerTransport } from './worker-runtime.ts'

const schema = defineParameterSchema({
	speed: { kind: 'number', default: 1, invalidation: 'hot-update' },
})

class FakeWorker implements WorkerTransport {
	readonly commands: RuntimeCommand[] = []
	terminated = false
	private readonly messageListeners = new Set<(event: MessageEvent<unknown>) => void>()
	private readonly errorListeners = new Set<(event: ErrorEvent) => void>()
	failInitialize = false

	postMessage(message: unknown): void {
		const command = message as RuntimeCommand
		this.commands.push(command)
		queueMicrotask(() => {
			if (this.failInitialize && command.type === 'initialize') {
				this.emit({ protocolVersion: RUNTIME_PROTOCOL_VERSION, type: 'error', requestId: command.requestId, error: { code: 'INIT_FAILED', message: 'init failed', recoverable: false } })
				return
			}
			this.emit(command.type === 'initialize'
				? { protocolVersion: RUNTIME_PROTOCOL_VERSION, type: 'ready', requestId: command.requestId }
				: { protocolVersion: RUNTIME_PROTOCOL_VERSION, type: 'ack', requestId: command.requestId })
		})
	}

	addEventListener(type: 'message' | 'error', listener: ((event: MessageEvent<unknown>) => void) | ((event: ErrorEvent) => void)): void {
		if (type === 'message') this.messageListeners.add(listener as (event: MessageEvent<unknown>) => void)
		else this.errorListeners.add(listener as (event: ErrorEvent) => void)
	}

	removeEventListener(type: 'message' | 'error', listener: ((event: MessageEvent<unknown>) => void) | ((event: ErrorEvent) => void)): void {
		if (type === 'message') this.messageListeners.delete(listener as (event: MessageEvent<unknown>) => void)
		else this.errorListeners.delete(listener as (event: ErrorEvent) => void)
	}

	terminate(): void { this.terminated = true }

	private emit(data: unknown): void {
		for (const listener of this.messageListeners) listener({ data } as MessageEvent<unknown>)
	}
}

test('orders commands, acknowledges lifecycle, and terminates cleanly', async () => {
	const worker = new FakeWorker()
	const runtime = new WorkerRuntime<typeof schema, { type: 'nudge' }, { seed: string }>({
		createWorker: () => worker,
		initializePayload: { seed: 'fixture' },
		initializeTransfer: [{} as Transferable],
	})

	await runtime.initialize()
	await runtime.start()
	await Promise.all([
		runtime.resize({ cssWidth: 100, cssHeight: 80, devicePixelRatio: 1, backingWidth: 100, backingHeight: 80 }),
		runtime.updateParameters({ speed: 2 }),
		runtime.applyInput({ type: 'nudge' }),
	])
	await runtime.pause()
	await runtime.resume()
	await runtime.reset()
	await runtime.dispose()

	assert.deepEqual(worker.commands.map(({ sequence }) => sequence), worker.commands.map((_, index) => index))
	assert.deepEqual(worker.commands.map(({ type }) => type), ['initialize', 'resume', 'resize', 'parameters', 'input', 'pause', 'resume', 'reset', 'dispose'])
	assert.equal(runtime.needsCanvasRemount, true)
	assert.equal(runtime.state, 'disposed')
	assert.equal(worker.terminated, true)
})

test('turns structured initialization errors into failed runtime state', async () => {
	const worker = new FakeWorker()
	worker.failInitialize = true
	const runtime = new WorkerRuntime<typeof schema, never, Record<string, never>>({
		createWorker: () => worker,
		initializePayload: {},
	})

	await assert.rejects(() => runtime.initialize(), (error) => error instanceof RuntimeRemoteError && error.code === 'INIT_FAILED')
	assert.equal(runtime.state, 'failed')
	assert.equal(worker.terminated, true)
	await runtime.dispose()
	assert.equal(runtime.state, 'disposed')
})
