import {
	COLLABORATION_PROTOCOL_VERSION,
	COLLABORATION_WIRE_VERSION,
	CollaborationReplica,
	encodeClientCollaborationWireMessage,
	parseServerCollaborationWireMessage,
} from '../../../src-v2/collaboration/index.ts'
import type {
	AuthoritativeSubmitResult,
	AuthoritativeTick,
	CollaborationResumePlan,
	CollaborationRoomDescriptor,
	CollaborationStateAdapter,
} from '../../../src-v2/collaboration/index.ts'
import type { SimulationStep } from '../../../src-v2/core/index.ts'
import type {
	ErasedExperimentSession,
	StudioCollaborationBootstrapConfiguration,
	StudioExperimentPlugin,
} from './studio-experiment-plugin.ts'

const WEB_SOCKET_OPEN = 1
const WEB_SOCKET_CLOSED = 3

export interface SharedExperimentSessionFactoryInput {
	readonly plugin: StudioExperimentPlugin
	readonly descriptor: CollaborationRoomDescriptor
	readonly configuration: StudioCollaborationBootstrapConfiguration
}

export interface ConnectSharedExperimentOptions {
	readonly url: string
	readonly roomId: string
	readonly participantId: string
	readonly resolvePlugin: (experimentId: string) => StudioExperimentPlugin | undefined
	readonly createSession: (input: SharedExperimentSessionFactoryInput) => ErasedExperimentSession
	readonly socketFactory?: (url: string) => WebSocket
	readonly onError?: (error: Error) => void
}

const errorFromUnknown = (error: unknown): Error =>
	error instanceof Error ? error : new Error(String(error))

const messageText = (event: MessageEvent): string => {
	if (typeof event.data !== 'string') throw new Error('Shared experiment transport requires UTF-8 text WebSocket messages.')
	return event.data
}

const waitForOpen = async (socket: WebSocket): Promise<void> => {
	if (socket.readyState === WEB_SOCKET_OPEN) return
	await new Promise<void>((resolve, reject) => {
		const onOpen = (): void => {
			cleanup()
			resolve()
		}
		const onError = (): void => {
			cleanup()
			reject(new Error('Shared experiment WebSocket failed to open.'))
		}
		const cleanup = (): void => {
			socket.removeEventListener('open', onOpen)
			socket.removeEventListener('error', onError)
		}
		socket.addEventListener('open', onOpen)
		socket.addEventListener('error', onError)
	})
}

const describeRoom = async (socket: WebSocket): Promise<CollaborationRoomDescriptor> => {
	const descriptor = new Promise<CollaborationRoomDescriptor>((resolve, reject) => {
		const onMessage = (event: MessageEvent): void => {
			try {
				const parsed = parseServerCollaborationWireMessage(messageText(event))
				if (!parsed.ok) throw new Error(parsed.error)
				if (parsed.value.type === 'error') throw new Error(parsed.value.error)
				if (parsed.value.type !== 'room-descriptor') {
					throw new Error(`Expected room descriptor, received '${parsed.value.type}'.`)
				}
				cleanup()
				resolve(parsed.value.descriptor)
			} catch (error) {
				cleanup()
				reject(errorFromUnknown(error))
			}
		}
		const onClose = (): void => {
			cleanup()
			reject(new Error('Shared experiment WebSocket closed before room bootstrap completed.'))
		}
		const cleanup = (): void => {
			socket.removeEventListener('message', onMessage)
			socket.removeEventListener('close', onClose)
		}
		socket.addEventListener('message', onMessage)
		socket.addEventListener('close', onClose)
	})
	socket.send(encodeClientCollaborationWireMessage({
		wireVersion: COLLABORATION_WIRE_VERSION,
		type: 'describe-room',
	}))
	return descriptor
}

const createAdapter = (
	plugin: StudioExperimentPlugin,
	session: ErasedExperimentSession,
	configurationBytes: Uint8Array,
): CollaborationStateAdapter<unknown> => {
	const collaboration = plugin.collaboration
	const sessionCollaboration = session.collaboration
	if (!collaboration || !sessionCollaboration) {
		throw new Error(`Experiment '${plugin.id}' does not expose the Studio collaboration capability.`)
	}
	return {
		parseInput: (value) => plugin.parseInput(value),
		encodeInput: (input) => collaboration.encodeInput(input),
		decodeInput: (bytes) => collaboration.decodeInput(bytes),
		applyInput: (input) => session.applyInput(input),
		captureConfigurationBytes: () => configurationBytes.slice(),
		captureStateBytes: () => sessionCollaboration.captureStateBytes(),
		restoreStateBytes: (bytes) => sessionCollaboration.restoreStateBytes(bytes),
	}
}

export class SharedExperimentClient {
	readonly descriptor: CollaborationRoomDescriptor
	readonly plugin: StudioExperimentPlugin
	readonly session: ErasedExperimentSession
	private readonly url: string
	private readonly participantId: string
	private readonly socketFactory: (url: string) => WebSocket
	private readonly onError: ((error: Error) => void) | undefined
	private readonly replica: CollaborationReplica<unknown>
	private socket: WebSocket
	private nextClientEventId = 1
	private knownSequence = 0
	private pendingResume: {
		resolve: (plan: CollaborationResumePlan<unknown>) => void
		reject: (error: Error) => void
	} | undefined
	private pendingSubmit: {
		resolve: (result: AuthoritativeSubmitResult<unknown>) => void
		reject: (error: Error) => void
	} | undefined
	private stateTail: Promise<void> = Promise.resolve()
	private processingError: Error | undefined
	private disposed = false

	private constructor(options: {
		readonly url: string
		readonly participantId: string
		readonly socketFactory: (url: string) => WebSocket
		readonly onError?: (error: Error) => void
		readonly socket: WebSocket
		readonly descriptor: CollaborationRoomDescriptor
		readonly plugin: StudioExperimentPlugin
		readonly session: ErasedExperimentSession
		readonly replica: CollaborationReplica<unknown>
	}) {
		this.url = options.url
		this.participantId = options.participantId
		this.socketFactory = options.socketFactory
		this.onError = options.onError
		this.socket = options.socket
		this.descriptor = options.descriptor
		this.plugin = options.plugin
		this.session = options.session
		this.replica = options.replica
		this.installSocketHandlers(options.socket)
	}

	static async connect(options: ConnectSharedExperimentOptions): Promise<SharedExperimentClient> {
		const socketFactory = options.socketFactory ?? ((url: string) => new WebSocket(url))
		const socket = socketFactory(options.url)
		await waitForOpen(socket)
		const descriptor = await describeRoom(socket)
		if (descriptor.protocolVersion !== COLLABORATION_PROTOCOL_VERSION || descriptor.roomId !== options.roomId) {
			socket.close()
			throw new Error('Shared experiment room descriptor does not match the requested room.')
		}
		const plugin = options.resolvePlugin(descriptor.experimentId)
		if (!plugin) {
			socket.close()
			throw new Error(`Shared experiment '${descriptor.experimentId}' is not registered in this Studio build.`)
		}
		if (plugin.stateVersion !== descriptor.stateVersion || !plugin.collaboration) {
			socket.close()
			throw new Error(`Shared experiment '${plugin.id}' has an incompatible state or collaboration capability.`)
		}
		if (plugin.collaboration.configurationVersion !== descriptor.configurationVersion) {
			socket.close()
			throw new Error(`Shared experiment '${plugin.id}' uses an incompatible collaboration configuration version.`)
		}
		const configuration = plugin.collaboration.decodeConfiguration(descriptor.configurationBytes)
		if (!configuration.ok) {
			socket.close()
			throw new Error(configuration.error)
		}
		const session = options.createSession({ plugin, descriptor, configuration: configuration.value })
		if (!session.collaboration) {
			session.dispose()
			socket.close()
			throw new Error(`Shared experiment '${plugin.id}' session does not expose checkpoint restoration.`)
		}
		const replica = new CollaborationReplica({
			roomId: descriptor.roomId,
			experimentId: descriptor.experimentId,
			stateVersion: descriptor.stateVersion,
			adapter: createAdapter(plugin, session, descriptor.configurationBytes),
		})
		const client = new SharedExperimentClient({
			url: options.url,
			participantId: options.participantId,
			socketFactory,
			...(options.onError ? { onError: options.onError } : {}),
			socket,
			descriptor,
			plugin,
			session,
			replica,
		})
		try {
			await client.resumeFromLocalState()
			return client
		} catch (error) {
			await client.dispose()
			throw error
		}
	}

	get connected(): boolean {
		return !this.disposed && this.socket.readyState === WEB_SOCKET_OPEN
	}

	get currentStepIndex(): number {
		return this.replica.currentStepIndex
	}

	get lastAppliedSequence(): number {
		return this.replica.lastAppliedSequence
	}

	get requiresResynchronization(): boolean {
		return this.replica.requiresResynchronization
	}

	private fail(error: unknown): Error {
		const resolved = errorFromUnknown(error)
		this.processingError = resolved
		this.onError?.(resolved)
		return resolved
	}

	private enqueueState(operation: () => void | Promise<void>): void {
		const run = this.stateTail.then(operation, operation)
		this.stateTail = run.then(
			() => undefined,
			(error) => { this.fail(error) },
		)
	}

	private installSocketHandlers(socket: WebSocket): void {
		socket.addEventListener('message', (event) => {
			try {
				const parsed = parseServerCollaborationWireMessage<unknown>(messageText(event))
				if (!parsed.ok) throw new Error(parsed.error)
				const message = parsed.value
				if (message.type === 'resume-plan') {
					const pending = this.pendingResume
					this.pendingResume = undefined
					if (pending) pending.resolve(message.plan)
					return
				}
				if (message.type === 'submit-result') {
					const pending = this.pendingSubmit
					this.pendingSubmit = undefined
					if (pending) pending.resolve(message.result)
					return
				}
				if (message.type === 'error') {
					const error = new Error(message.error)
					this.pendingResume?.reject(error)
					this.pendingSubmit?.reject(error)
					this.pendingResume = undefined
					this.pendingSubmit = undefined
					this.fail(error)
					return
				}
				if (message.type === 'authoritative-event') {
					this.enqueueState(() => {
						this.knownSequence = Math.max(this.knownSequence, message.event.sequence)
						const received = this.replica.receive(message.event)
						if (received.status === 'needs-resync') return this.resumeFromLocalState()
					})
					return
				}
				if (message.type === 'authoritative-tick') {
					this.enqueueState(() => this.acceptTick(message.tick))
				}
			} catch (error) {
				this.fail(error)
			}
		})
		socket.addEventListener('close', () => {
			if (socket !== this.socket || this.disposed) return
			const error = new Error('Shared experiment WebSocket closed; reconnect is required.')
			this.pendingResume?.reject(error)
			this.pendingSubmit?.reject(error)
			this.pendingResume = undefined
			this.pendingSubmit = undefined
		})
	}

	private async waitForResumePlan(): Promise<CollaborationResumePlan<unknown>> {
		if (this.pendingResume) throw new Error('A shared experiment resume is already in progress.')
		return new Promise<CollaborationResumePlan<unknown>>((resolve, reject) => {
			this.pendingResume = { resolve, reject }
		})
	}

	private simulationStep(index: number): SimulationStep {
		const dtSeconds = this.plugin.timing.fixedStepSeconds
		return { index, dtSeconds, elapsedSeconds: (index + 1) * dtSeconds }
	}

	private async advanceToTick(tick: AuthoritativeTick): Promise<void> {
		this.knownSequence = Math.max(this.knownSequence, tick.logHeadSequence)
		while (this.replica.currentStepIndex < tick.stepIndex) {
			const stepIndex = this.replica.currentStepIndex
			this.session.step(this.simulationStep(stepIndex))
			const advanced = this.replica.advanceStepIndex(stepIndex + 1)
			if (!advanced.ok) throw new Error(advanced.error)
		}
		const verification = await this.replica.verifyPendingSyncPoint()
		if (!verification.ok) throw new Error(verification.error)
		if (verification.value && !verification.value.matches) await this.resumeFromLocalState()
	}

	private async acceptTick(tick: AuthoritativeTick): Promise<void> {
		const received = this.replica.receiveTick(tick)
		if (!received.ok) {
			await this.resumeFromLocalState()
			return
		}
		await this.advanceToTick(tick)
	}

	private async resumeFromLocalState(): Promise<void> {
		if (this.socket.readyState !== WEB_SOCKET_OPEN) throw new Error('Shared experiment WebSocket is not connected.')
		const request = await this.replica.createResumeRequest()
		const pending = this.waitForResumePlan()
		this.socket.send(encodeClientCollaborationWireMessage({
			wireVersion: COLLABORATION_WIRE_VERSION,
			type: 'resume',
			request,
		}))
		const plan = await pending
		if (!plan.ok) throw new Error(plan.error)
		const applied = await this.replica.applyResumePlan(plan)
		if (!applied.ok) throw new Error(applied.error)
		this.knownSequence = Math.max(this.knownSequence, plan.tick.logHeadSequence)
		await this.advanceToTick(plan.tick)
	}

	async submit(input: unknown): Promise<AuthoritativeSubmitResult<unknown>> {
		if (this.disposed || this.socket.readyState !== WEB_SOCKET_OPEN) {
			throw new Error('Shared experiment client is not connected.')
		}
		if (this.pendingSubmit) throw new Error('Only one shared experiment input submission may be in flight at a time.')
		const parsed = this.plugin.parseInput(input)
		if (!parsed.ok) throw new Error(parsed.error)
		const clientEventId = `event-${this.nextClientEventId++}`
		const resultPromise = new Promise<AuthoritativeSubmitResult<unknown>>((resolve, reject) => {
			this.pendingSubmit = { resolve, reject }
		})
		this.socket.send(encodeClientCollaborationWireMessage({
			wireVersion: COLLABORATION_WIRE_VERSION,
			type: 'submit',
			proposal: {
				protocolVersion: COLLABORATION_PROTOCOL_VERSION,
				roomId: this.descriptor.roomId,
				participantId: this.participantId,
				clientEventId,
				knownSequence: this.knownSequence,
				input: parsed.value,
			},
		}))
		const result = await resultPromise
		if (result.ok) {
			this.knownSequence = Math.max(this.knownSequence, result.event.sequence)
			const received = this.replica.receive(result.event)
			if (received.status === 'needs-resync') await this.resumeFromLocalState()
		}
		return result
	}

	async waitForIdle(): Promise<void> {
		await this.stateTail
		if (this.processingError) {
			const error = this.processingError
			this.processingError = undefined
			throw error
		}
	}

	async disconnect(): Promise<void> {
		if (this.socket.readyState === WEB_SOCKET_CLOSED) return
		await new Promise<void>((resolve) => {
			this.socket.addEventListener('close', () => resolve(), { once: true })
			this.socket.close()
		})
	}

	async reconnect(): Promise<void> {
		if (this.disposed) throw new Error('Cannot reconnect a disposed shared experiment client.')
		if (this.socket.readyState === WEB_SOCKET_OPEN) return
		const socket = this.socketFactory(this.url)
		await waitForOpen(socket)
		const descriptor = await describeRoom(socket)
		if (descriptor.roomId !== this.descriptor.roomId
			|| descriptor.experimentId !== this.descriptor.experimentId
			|| descriptor.stateVersion !== this.descriptor.stateVersion
			|| descriptor.configurationVersion !== this.descriptor.configurationVersion
			|| descriptor.configurationBytes.byteLength !== this.descriptor.configurationBytes.byteLength
			|| descriptor.configurationBytes.some((byte, index) => byte !== this.descriptor.configurationBytes[index])) {
			socket.close()
			throw new Error('Shared experiment room identity changed while the client was disconnected.')
		}
		this.socket = socket
		this.installSocketHandlers(socket)
		await this.resumeFromLocalState()
	}

	dispose(): Promise<void> {
		if (this.disposed) return Promise.resolve()
		this.disposed = true
		if (this.socket.readyState !== WEB_SOCKET_CLOSED) this.socket.close()
		this.session.dispose()
		return Promise.resolve()
	}
}

export const connectSharedExperiment = (options: ConnectSharedExperimentOptions): Promise<SharedExperimentClient> =>
	SharedExperimentClient.connect(options)
