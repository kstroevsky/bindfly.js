import { createSnapshotChecksum, encodeCanonicalSnapshotV1 } from './canonical-snapshot.ts'
import { COLLABORATION_PROTOCOL_VERSION } from './protocol.ts'
import type {
	AuthoritativeEvent,
	AuthoritativeSnapshot,
	AuthoritativeSubmitResult,
	ClientEventProposal,
	CollaborationStateAdapter,
} from './protocol.ts'

const DEFAULT_MAX_INPUT_BYTES = 4_096
const MAX_ID_LENGTH = 128

export interface InMemoryAuthoritativeRoomOptions<Input> {
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly adapter: CollaborationStateAdapter<Input>
	readonly maxInputBytes?: number
}

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
	if (left.byteLength !== right.byteLength) return false
	for (let index = 0; index < left.byteLength; index++) {
		if (left[index] !== right[index]) return false
	}
	return true
}

const validIdentity = (value: string): boolean => value.length > 0 && value.length <= MAX_ID_LENGTH

export class InMemoryAuthoritativeRoom<Input> {
	private readonly roomId: string
	private readonly experimentId: string
	private readonly stateVersion: number
	private readonly adapter: CollaborationStateAdapter<Input>
	private readonly maxInputBytes: number
	private readonly events: AuthoritativeEvent<Input>[] = []
	private readonly acceptedByClientId = new Map<string, { event: AuthoritativeEvent<Input>; inputBytes: Uint8Array }>()
	private stepIndex = 0

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
		this.roomId = options.roomId
		this.experimentId = options.experimentId
		this.stateVersion = options.stateVersion
		this.adapter = options.adapter
		this.maxInputBytes = maxInputBytes
	}

	get eventLog(): readonly AuthoritativeEvent<Input>[] {
		return [...this.events]
	}

	get lastSequence(): number {
		return this.events.at(-1)?.sequence ?? 0
	}

	get currentStepIndex(): number {
		return this.stepIndex
	}

	advanceStepIndex(nextStepIndex: number): void {
		if (!Number.isSafeInteger(nextStepIndex) || nextStepIndex < this.stepIndex) {
			throw new RangeError('Authoritative step index must advance monotonically.')
		}
		this.stepIndex = nextStepIndex
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
		if (proposal.knownSequence > this.lastSequence) {
			return { ok: false, code: 'AHEAD_OF_AUTHORITY', error: 'Client sequence is ahead of the authoritative event log.' }
		}

		const parsed = this.adapter.parseInput(proposal.input)
		if (!parsed.ok) return { ok: false, code: 'INVALID_INPUT', error: parsed.error }
		const inputBytes = this.adapter.encodeInput(parsed.value)
		if (inputBytes.byteLength > this.maxInputBytes) {
			return { ok: false, code: 'INPUT_TOO_LARGE', error: `Input exceeds ${this.maxInputBytes} bytes.` }
		}

		const idempotencyKey = `${proposal.participantId}\u0000${proposal.clientEventId}`
		const existing = this.acceptedByClientId.get(idempotencyKey)
		if (existing) {
			if (!bytesEqual(existing.inputBytes, inputBytes)) {
				return { ok: false, code: 'IDEMPOTENCY_CONFLICT', error: 'Client event ID was reused with a different input.' }
			}
			return { ok: true, event: existing.event, duplicate: true }
		}

		const event: AuthoritativeEvent<Input> = {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			participantId: proposal.participantId,
			clientEventId: proposal.clientEventId,
			sequence: this.lastSequence + 1,
			stepIndex: this.stepIndex,
			input: parsed.value,
		}
		this.adapter.applyInput(parsed.value)
		this.events.push(event)
		this.acceptedByClientId.set(idempotencyKey, { event, inputBytes: inputBytes.slice() })
		return { ok: true, event, duplicate: false }
	}

	async createSnapshot(): Promise<AuthoritativeSnapshot> {
		const configurationBytes = this.adapter.captureConfigurationBytes().slice()
		const stateBytes = this.adapter.captureStateBytes().slice()
		const canonicalBytes = encodeCanonicalSnapshotV1({
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			lastSequence: this.lastSequence,
			stepIndex: this.stepIndex,
			configurationBytes,
			stateBytes,
		})
		return {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			lastSequence: this.lastSequence,
			stepIndex: this.stepIndex,
			configurationBytes,
			stateBytes,
			checksum: await createSnapshotChecksum(canonicalBytes),
		}
	}
}
