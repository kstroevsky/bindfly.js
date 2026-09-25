import { createSnapshotChecksum, encodeCanonicalSnapshotV1, snapshotChecksumsEqual } from './canonical-snapshot.ts'
import {
	AUTHORITATIVE_ROOM_PERSISTENCE_VERSION,
	COLLABORATION_PROTOCOL_VERSION,
	MAX_COLLABORATION_ID_LENGTH,
} from './protocol.ts'
import type { Result } from '../core/result.ts'
import type {
	AuthoritativeEvent,
	AuthoritativeRoomPersistenceState,
	AuthoritativeSnapshot,
	AuthoritativeSubmitResult,
	AuthoritativeTick,
	ClientEventProposal,
	CollaborationResumePlan,
	CollaborationResumeRequest,
	CollaborationStateAdapter,
	PersistedAuthoritativeEvent,
} from './protocol.ts'

const DEFAULT_MAX_INPUT_BYTES = 4_096
const DEFAULT_INPUT_LEAD_STEPS = 1
const DEFAULT_MAX_REPLAY_EVENTS = 256
const DEFAULT_MAX_INPUTS_PER_PARTICIPANT_PER_STEP = 64

export interface InMemoryAuthoritativeRoomOptions<Input> {
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly adapter: CollaborationStateAdapter<Input>
	readonly authorizeInput: (participantId: string, input: Input) => Result<void, string>
	readonly maxInputBytes?: number
	readonly inputLeadSteps?: number
	readonly maxReplayEvents?: number
	readonly maxInputsPerParticipantPerStep?: number
}

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
	if (left.byteLength !== right.byteLength) return false
	for (let index = 0; index < left.byteLength; index++) {
		if (left[index] !== right[index]) return false
	}
	return true
}

const validIdentity = (value: string): boolean =>
	value.length > 0 && value.length <= MAX_COLLABORATION_ID_LENGTH

export class InMemoryAuthoritativeRoom<Input> {
	private readonly roomId: string
	private readonly experimentId: string
	private readonly stateVersion: number
	private readonly adapter: CollaborationStateAdapter<Input>
	private readonly authorizeInput: (participantId: string, input: Input) => Result<void, string>
	private readonly maxInputBytes: number
	private readonly inputLeadSteps: number
	private readonly maxReplayEvents: number
	private readonly maxInputsPerParticipantPerStep: number
	private readonly events: AuthoritativeEvent<Input>[] = []
	private readonly acceptedByClientId = new Map<string, { event: AuthoritativeEvent<Input>; inputBytes: Uint8Array }>()
	private readonly participantStepUsage = new Map<string, { stepIndex: number; count: number }>()
	private stepIndex = 0
	private appliedSequenceValue = 0

	constructor(options: InMemoryAuthoritativeRoomOptions<Input>) {
		if (!validIdentity(options.roomId)) throw new Error('Collaboration roomId must be non-empty and bounded.')
		if (!validIdentity(options.experimentId)) throw new Error('Collaboration experimentId must be non-empty and bounded.')
		if (!Number.isInteger(options.stateVersion) || options.stateVersion <= 0) {
			throw new RangeError('Collaboration stateVersion must be a positive integer.')
		}
		const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES
		if (!Number.isInteger(maxInputBytes) || maxInputBytes <= 0) {
			throw new RangeError('Collaboration maxInputBytes must be a positive integer.')
		}
		const inputLeadSteps = options.inputLeadSteps ?? DEFAULT_INPUT_LEAD_STEPS
		if (!Number.isSafeInteger(inputLeadSteps) || inputLeadSteps <= 0) {
			throw new RangeError('Collaboration inputLeadSteps must be a positive safe integer.')
		}
		const maxReplayEvents = options.maxReplayEvents ?? DEFAULT_MAX_REPLAY_EVENTS
		if (!Number.isSafeInteger(maxReplayEvents) || maxReplayEvents < 0) {
			throw new RangeError('Collaboration maxReplayEvents must be a non-negative safe integer.')
		}
		const maxInputsPerParticipantPerStep = options.maxInputsPerParticipantPerStep
			?? DEFAULT_MAX_INPUTS_PER_PARTICIPANT_PER_STEP
		if (!Number.isSafeInteger(maxInputsPerParticipantPerStep) || maxInputsPerParticipantPerStep <= 0) {
			throw new RangeError('Collaboration maxInputsPerParticipantPerStep must be a positive safe integer.')
		}
		this.roomId = options.roomId
		this.experimentId = options.experimentId
		this.stateVersion = options.stateVersion
		this.adapter = options.adapter
		this.authorizeInput = options.authorizeInput
		this.maxInputBytes = maxInputBytes
		this.inputLeadSteps = inputLeadSteps
		this.maxReplayEvents = maxReplayEvents
		this.maxInputsPerParticipantPerStep = maxInputsPerParticipantPerStep
	}

	static async recover<Input>(
		options: InMemoryAuthoritativeRoomOptions<Input>,
		persisted: AuthoritativeRoomPersistenceState,
	): Promise<InMemoryAuthoritativeRoom<Input>> {
		const room = new InMemoryAuthoritativeRoom(options)
		if (persisted.persistenceVersion !== AUTHORITATIVE_ROOM_PERSISTENCE_VERSION) {
			throw new Error('Unsupported authoritative-room persistence version.')
		}
		if (persisted.inputLeadSteps !== room.inputLeadSteps) {
			throw new Error('Persisted authoritative-room input scheduling policy does not match the room being recovered.')
		}
		const { snapshot } = persisted
		if (snapshot.protocolVersion !== COLLABORATION_PROTOCOL_VERSION) {
			throw new Error('Persisted authoritative snapshot uses an incompatible collaboration protocol version.')
		}
		if (snapshot.roomId !== room.roomId || snapshot.experimentId !== room.experimentId || snapshot.stateVersion !== room.stateVersion) {
			throw new Error('Persisted authoritative snapshot identity does not match the room being recovered.')
		}
		if (!Number.isSafeInteger(snapshot.lastAppliedSequence) || snapshot.lastAppliedSequence < 0
			|| !Number.isSafeInteger(snapshot.stepIndex) || snapshot.stepIndex < 0) {
			throw new Error('Persisted authoritative snapshot sequence or step index is invalid.')
		}
		const expectedChecksum = await createSnapshotChecksum(encodeCanonicalSnapshotV1({
			roomId: snapshot.roomId,
			experimentId: snapshot.experimentId,
			stateVersion: snapshot.stateVersion,
			lastAppliedSequence: snapshot.lastAppliedSequence,
			stepIndex: snapshot.stepIndex,
			configurationBytes: snapshot.configurationBytes,
			stateBytes: snapshot.stateBytes,
		}))
		if (!snapshotChecksumsEqual(snapshot.checksum, expectedChecksum)) {
			throw new Error('Persisted authoritative snapshot checksum verification failed.')
		}
		if (!bytesEqual(snapshot.configurationBytes, room.adapter.captureConfigurationBytes())) {
			throw new Error('Persisted authoritative snapshot configuration does not match the room adapter.')
		}
		if (snapshot.lastAppliedSequence > persisted.events.length) {
			throw new Error('Persisted authoritative snapshot references an event sequence beyond the stored log.')
		}

		const recoveredEvents: Array<{ event: AuthoritativeEvent<Input>; inputBytes: Uint8Array }> = []
		const recoveredClientIds = new Set<string>()
		let previousStepIndex = 0
		for (let index = 0; index < persisted.events.length; index++) {
			const stored = persisted.events[index]!
			const expectedSequence = index + 1
			if (stored.protocolVersion !== COLLABORATION_PROTOCOL_VERSION
				|| stored.roomId !== room.roomId
				|| stored.experimentId !== room.experimentId
				|| stored.stateVersion !== room.stateVersion) {
				throw new Error(`Persisted authoritative event ${expectedSequence} has incompatible room identity.`)
			}
			if (stored.sequence !== expectedSequence) {
				throw new Error(`Persisted authoritative event sequence ${stored.sequence} is not the expected contiguous sequence ${expectedSequence}.`)
			}
			if (!validIdentity(stored.participantId) || !validIdentity(stored.clientEventId)) {
				throw new Error(`Persisted authoritative event ${stored.sequence} has invalid participant/client identity.`)
			}
			if (!Number.isSafeInteger(stored.stepIndex) || stored.stepIndex <= 0 || stored.stepIndex < previousStepIndex) {
				throw new Error(`Persisted authoritative event ${stored.sequence} has an invalid scheduled step.`)
			}
			if (stored.sequence <= snapshot.lastAppliedSequence && stored.stepIndex > snapshot.stepIndex) {
				throw new Error(`Persisted authoritative event ${stored.sequence} is marked applied before its scheduled step.`)
			}
			if (stored.sequence > snapshot.lastAppliedSequence && stored.stepIndex <= snapshot.stepIndex) {
				throw new Error(`Persisted authoritative event ${stored.sequence} is missing from snapshot state despite being due.`)
			}
			const decoded = room.adapter.decodeInput(stored.inputBytes)
			if (!decoded.ok) throw new Error(`Persisted authoritative event ${stored.sequence} input is invalid: ${decoded.error}`)
			const canonicalInputBytes = room.adapter.encodeInput(decoded.value)
			if (!bytesEqual(canonicalInputBytes, stored.inputBytes)) {
				throw new Error(`Persisted authoritative event ${stored.sequence} input bytes are not canonical.`)
			}
			const idempotencyKey = JSON.stringify([stored.participantId, stored.clientEventId])
			if (recoveredClientIds.has(idempotencyKey)) {
				throw new Error(`Persisted authoritative event ${stored.sequence} reuses an existing participant/client event ID.`)
			}
			recoveredClientIds.add(idempotencyKey)
			recoveredEvents.push({
				event: {
					protocolVersion: COLLABORATION_PROTOCOL_VERSION,
					roomId: room.roomId,
					experimentId: room.experimentId,
					stateVersion: room.stateVersion,
					participantId: stored.participantId,
					clientEventId: stored.clientEventId,
					sequence: stored.sequence,
					stepIndex: stored.stepIndex,
					input: decoded.value,
				},
				inputBytes: canonicalInputBytes,
			})
			previousStepIndex = stored.stepIndex
		}

		room.adapter.restoreStateBytes(snapshot.stateBytes.slice())
		room.stepIndex = snapshot.stepIndex
		room.appliedSequenceValue = snapshot.lastAppliedSequence
		for (const recovered of recoveredEvents) {
			room.events.push(recovered.event)
			const idempotencyKey = JSON.stringify([recovered.event.participantId, recovered.event.clientEventId])
			room.acceptedByClientId.set(idempotencyKey, {
				event: recovered.event,
				inputBytes: recovered.inputBytes.slice(),
			})
			if (recovered.event.stepIndex === room.stepIndex + room.inputLeadSteps) {
				const usage = room.participantStepUsage.get(recovered.event.participantId)
				room.participantStepUsage.set(recovered.event.participantId, {
					stepIndex: room.stepIndex,
					count: (usage?.stepIndex === room.stepIndex ? usage.count : 0) + 1,
				})
			}
		}
		return room
	}

	get eventLog(): readonly AuthoritativeEvent<Input>[] {
		return [...this.events]
	}

	get logHeadSequence(): number {
		return this.events.at(-1)?.sequence ?? 0
	}

	get appliedSequence(): number {
		return this.appliedSequenceValue
	}

	get currentStepIndex(): number {
		return this.stepIndex
	}

	advanceStepIndex(nextStepIndex: number): void {
		if (!Number.isSafeInteger(nextStepIndex) || nextStepIndex < this.stepIndex || nextStepIndex > this.stepIndex + 1) {
			throw new RangeError('Authoritative step index must advance monotonically one boundary at a time.')
		}
		if (nextStepIndex === this.stepIndex) return
		this.stepIndex = nextStepIndex
		while (this.appliedSequenceValue < this.events.length) {
			const event = this.events[this.appliedSequenceValue]!
			if (event.stepIndex > this.stepIndex) break
			this.adapter.applyInput(event.input)
			this.appliedSequenceValue = event.sequence
		}
	}

	createTick(): AuthoritativeTick {
		return {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			stepIndex: this.stepIndex,
			logHeadSequence: this.logHeadSequence,
			appliedSequence: this.appliedSequenceValue,
		}
	}

	submit(proposal: ClientEventProposal): AuthoritativeSubmitResult<Input> {
		if (proposal.protocolVersion !== COLLABORATION_PROTOCOL_VERSION) {
			return { ok: false, code: 'PROTOCOL_VERSION_MISMATCH', error: 'Unsupported collaboration protocol version.' }
		}
		if (proposal.roomId !== this.roomId) {
			return { ok: false, code: 'ROOM_MISMATCH', error: 'Event proposal targets a different collaboration room.' }
		}
		if (!validIdentity(proposal.participantId) || !validIdentity(proposal.clientEventId)) {
			return { ok: false, code: 'INVALID_IDENTITY', error: 'Participant and client event IDs must be non-empty and bounded.' }
		}
		if (!Number.isSafeInteger(proposal.knownSequence) || proposal.knownSequence < 0) {
			return { ok: false, code: 'INVALID_SEQUENCE', error: 'knownSequence must be a non-negative safe integer.' }
		}
		if (proposal.knownSequence > this.logHeadSequence) {
			return { ok: false, code: 'AHEAD_OF_AUTHORITY', error: 'Client sequence is ahead of the authoritative event log.' }
		}

		const parsed = this.adapter.parseInput(proposal.input)
		if (!parsed.ok) return { ok: false, code: 'INVALID_INPUT', error: parsed.error }
		const inputBytes = this.adapter.encodeInput(parsed.value)
		if (inputBytes.byteLength > this.maxInputBytes) {
			return { ok: false, code: 'INPUT_TOO_LARGE', error: `Input exceeds ${this.maxInputBytes} bytes.` }
		}
		const authorization = this.authorizeInput(proposal.participantId, parsed.value)
		if (!authorization.ok) return { ok: false, code: 'UNAUTHORIZED', error: authorization.error }

		const idempotencyKey = JSON.stringify([proposal.participantId, proposal.clientEventId])
		const existing = this.acceptedByClientId.get(idempotencyKey)
		if (existing) {
			if (!bytesEqual(existing.inputBytes, inputBytes)) {
				return { ok: false, code: 'IDEMPOTENCY_CONFLICT', error: 'Client event ID was reused with a different input.' }
			}
			return { ok: true, event: existing.event, duplicate: true }
		}

		const usage = this.participantStepUsage.get(proposal.participantId)
		const acceptedThisStep = usage?.stepIndex === this.stepIndex ? usage.count : 0
		if (acceptedThisStep >= this.maxInputsPerParticipantPerStep) {
			return {
				ok: false,
				code: 'RATE_LIMIT_EXCEEDED',
				error: `Participant exceeded ${this.maxInputsPerParticipantPerStep} accepted inputs for authoritative step ${this.stepIndex}.`,
			}
		}

		const scheduledStepIndex = this.stepIndex + this.inputLeadSteps
		if (!Number.isSafeInteger(scheduledStepIndex)) {
			return { ok: false, code: 'INVALID_SEQUENCE', error: 'Scheduled collaboration step exceeds the safe integer range.' }
		}
		const event: AuthoritativeEvent<Input> = {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			participantId: proposal.participantId,
			clientEventId: proposal.clientEventId,
			sequence: this.logHeadSequence + 1,
			stepIndex: scheduledStepIndex,
			input: parsed.value,
		}
		this.events.push(event)
		this.acceptedByClientId.set(idempotencyKey, { event, inputBytes: inputBytes.slice() })
		this.participantStepUsage.set(proposal.participantId, { stepIndex: this.stepIndex, count: acceptedThisStep + 1 })
		return { ok: true, event, duplicate: false }
	}

	async createSnapshot(): Promise<AuthoritativeSnapshot> {
		const configurationBytes = this.adapter.captureConfigurationBytes().slice()
		const stateBytes = this.adapter.captureStateBytes().slice()
		const canonicalBytes = encodeCanonicalSnapshotV1({
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			lastAppliedSequence: this.appliedSequenceValue,
			stepIndex: this.stepIndex,
			configurationBytes,
			stateBytes,
		})
		return {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			lastAppliedSequence: this.appliedSequenceValue,
			stepIndex: this.stepIndex,
			configurationBytes,
			stateBytes,
			checksum: await createSnapshotChecksum(canonicalBytes),
		}
	}

	async capturePersistenceState(): Promise<AuthoritativeRoomPersistenceState> {
		const snapshot = await this.createSnapshot()
		const events: PersistedAuthoritativeEvent[] = this.events.map((event) => ({
			protocolVersion: event.protocolVersion,
			roomId: event.roomId,
			experimentId: event.experimentId,
			stateVersion: event.stateVersion,
			participantId: event.participantId,
			clientEventId: event.clientEventId,
			sequence: event.sequence,
			stepIndex: event.stepIndex,
			inputBytes: this.adapter.encodeInput(event.input).slice(),
		}))
		return {
			persistenceVersion: AUTHORITATIVE_ROOM_PERSISTENCE_VERSION,
			inputLeadSteps: this.inputLeadSteps,
			snapshot,
			events,
		}
	}

	async createResumePlan(request: CollaborationResumeRequest): Promise<CollaborationResumePlan<Input>> {
		if (request.protocolVersion !== COLLABORATION_PROTOCOL_VERSION) {
			return { ok: false, code: 'PROTOCOL_VERSION_MISMATCH', error: 'Unsupported collaboration protocol version.' }
		}
		if (request.roomId !== this.roomId) {
			return { ok: false, code: 'ROOM_MISMATCH', error: 'Resume request targets a different collaboration room.' }
		}
		if (request.experimentId !== this.experimentId) {
			return { ok: false, code: 'EXPERIMENT_MISMATCH', error: 'Resume request targets a different experiment.' }
		}
		if (request.stateVersion !== this.stateVersion) {
			return { ok: false, code: 'STATE_VERSION_MISMATCH', error: 'Resume request uses an incompatible state version.' }
		}
		if (!Number.isSafeInteger(request.lastAppliedSequence) || request.lastAppliedSequence < 0) {
			return { ok: false, code: 'INVALID_SEQUENCE', error: 'Resume sequence must be a non-negative safe integer.' }
		}
		if (!Number.isSafeInteger(request.stepIndex) || request.stepIndex < 0) {
			return { ok: false, code: 'INVALID_STEP_INDEX', error: 'Resume step index must be a non-negative safe integer.' }
		}
		if (request.lastAppliedSequence > this.appliedSequenceValue || request.stepIndex > this.stepIndex) {
			return { ok: false, code: 'AHEAD_OF_AUTHORITY', error: 'Resume state is ahead of authoritative applied state.' }
		}

		const lastAppliedEvent = request.lastAppliedSequence === 0 ? undefined : this.events[request.lastAppliedSequence - 1]
		if (lastAppliedEvent && lastAppliedEvent.stepIndex > request.stepIndex) {
			return { ok: false, code: 'INVALID_SEQUENCE', error: 'Resume sequence is inconsistent with the reported step index.' }
		}

		const firstMissing = this.events[request.lastAppliedSequence]
		const missedPastBoundary = firstMissing !== undefined && firstMissing.stepIndex <= request.stepIndex
		const replayCount = this.appliedSequenceValue - request.lastAppliedSequence
		let snapshotRequired = missedPastBoundary || replayCount > this.maxReplayEvents

		if (!snapshotRequired
			&& request.checksum
			&& request.lastAppliedSequence === this.appliedSequenceValue
			&& request.stepIndex === this.stepIndex) {
			const currentSnapshot = await this.createSnapshot()
			snapshotRequired = !snapshotChecksumsEqual(request.checksum, currentSnapshot.checksum)
		}

		const tick = this.createTick()
		if (!snapshotRequired) {
			return {
				ok: true,
				mode: 'replay',
				events: this.events.slice(request.lastAppliedSequence),
				tick,
			}
		}

		const snapshot = await this.createSnapshot()
		return {
			ok: true,
			mode: 'snapshot',
			snapshot,
			events: this.events.slice(snapshot.lastAppliedSequence),
			tick,
		}
	}
}
