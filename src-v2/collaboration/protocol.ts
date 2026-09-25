import type { Result } from '../core/result.ts'

export const COLLABORATION_PROTOCOL_VERSION = 1
export const CANONICAL_SNAPSHOT_ENCODING_VERSION = 1
export const SNAPSHOT_CHECKSUM_ALGORITHM = 'sha-256'
export const AUTHORITATIVE_ROOM_PERSISTENCE_VERSION = 1
export const MAX_COLLABORATION_ID_LENGTH = 128

export type SequenceNumber = number

export interface ClientEventProposal {
	readonly protocolVersion: number
	readonly roomId: string
	readonly participantId: string
	readonly clientEventId: string
	readonly knownSequence: SequenceNumber
	readonly input: unknown
}

export interface AuthoritativeEvent<Input> {
	readonly protocolVersion: typeof COLLABORATION_PROTOCOL_VERSION
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly participantId: string
	readonly clientEventId: string
	readonly sequence: SequenceNumber
	readonly stepIndex: number
	readonly input: Input
}

export interface AuthoritativeTick {
	readonly protocolVersion: typeof COLLABORATION_PROTOCOL_VERSION
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly stepIndex: number
	readonly logHeadSequence: SequenceNumber
	readonly appliedSequence: SequenceNumber
}

export interface SnapshotChecksum {
	readonly algorithm: typeof SNAPSHOT_CHECKSUM_ALGORITHM
	readonly encodingVersion: typeof CANONICAL_SNAPSHOT_ENCODING_VERSION
	readonly value: string
}

export interface AuthoritativeSnapshot {
	readonly protocolVersion: typeof COLLABORATION_PROTOCOL_VERSION
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly lastAppliedSequence: SequenceNumber
	readonly stepIndex: number
	readonly configurationBytes: Uint8Array
	readonly stateBytes: Uint8Array
	readonly checksum: SnapshotChecksum
}

export interface DivergenceEvidence {
	readonly matches: boolean
	readonly authoritativeChecksum: SnapshotChecksum
	readonly replicaChecksum: SnapshotChecksum
	readonly authoritativeLastAppliedSequence: SequenceNumber
	readonly replicaLastAppliedSequence: SequenceNumber
	readonly authoritativeStepIndex: number
	readonly replicaStepIndex: number
}

export interface CollaborationStateAdapter<Input> {
	parseInput(value: unknown): Result<Input, string>
	encodeInput(input: Input): Uint8Array
	decodeInput(bytes: Uint8Array): Result<Input, string>
	applyInput(input: Input): void
	captureConfigurationBytes(): Uint8Array
	captureStateBytes(): Uint8Array
	restoreStateBytes(bytes: Uint8Array): void
}

export interface PersistedAuthoritativeEvent {
	readonly protocolVersion: typeof COLLABORATION_PROTOCOL_VERSION
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly participantId: string
	readonly clientEventId: string
	readonly sequence: SequenceNumber
	readonly stepIndex: number
	readonly inputBytes: Uint8Array
}

export interface AuthoritativeRoomPersistenceState {
	readonly persistenceVersion: typeof AUTHORITATIVE_ROOM_PERSISTENCE_VERSION
	readonly inputLeadSteps: number
	readonly snapshot: AuthoritativeSnapshot
	readonly events: readonly PersistedAuthoritativeEvent[]
}

export interface CollaborationResumeRequest {
	readonly protocolVersion: number
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly lastAppliedSequence: SequenceNumber
	readonly stepIndex: number
	readonly checksum?: SnapshotChecksum
}

export type CollaborationResumePlan<Input> =
	| {
		readonly ok: true
		readonly mode: 'replay'
		readonly events: readonly AuthoritativeEvent<Input>[]
		readonly tick: AuthoritativeTick
	}
	| {
		readonly ok: true
		readonly mode: 'snapshot'
		readonly snapshot: AuthoritativeSnapshot
		readonly events: readonly AuthoritativeEvent<Input>[]
		readonly tick: AuthoritativeTick
	}
	| {
		readonly ok: false
		readonly code: CollaborationResumeErrorCode
		readonly error: string
	}

export type CollaborationResumeErrorCode =
	| 'PROTOCOL_VERSION_MISMATCH'
	| 'ROOM_MISMATCH'
	| 'EXPERIMENT_MISMATCH'
	| 'STATE_VERSION_MISMATCH'
	| 'INVALID_SEQUENCE'
	| 'INVALID_STEP_INDEX'
	| 'AHEAD_OF_AUTHORITY'

export type AuthoritativeSubmitErrorCode =
	| 'PROTOCOL_VERSION_MISMATCH'
	| 'ROOM_MISMATCH'
	| 'INVALID_IDENTITY'
	| 'INVALID_SEQUENCE'
	| 'AHEAD_OF_AUTHORITY'
	| 'INVALID_INPUT'
	| 'INPUT_TOO_LARGE'
	| 'RATE_LIMIT_EXCEEDED'
	| 'UNAUTHORIZED'
	| 'IDEMPOTENCY_CONFLICT'

export type AuthoritativeSubmitResult<Input> =
	| { readonly ok: true; readonly event: AuthoritativeEvent<Input>; readonly duplicate: boolean }
	| { readonly ok: false; readonly code: AuthoritativeSubmitErrorCode; readonly error: string }

export type ReplicaReceiveStatus =
	| 'applied'
	| 'buffered-gap'
	| 'buffered-step'
	| 'ignored-old'
	| 'needs-resync'

export interface ReplicaReceiveResult {
	readonly status: ReplicaReceiveStatus
	readonly lastAppliedSequence: SequenceNumber
	readonly stepIndex: number
}
