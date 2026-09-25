import type { Result } from '../core/result.ts'
import {
	CANONICAL_SNAPSHOT_ENCODING_VERSION,
	COLLABORATION_PROTOCOL_VERSION,
	SNAPSHOT_CHECKSUM_ALGORITHM,
} from './protocol.ts'
import type {
	AuthoritativeEvent,
	AuthoritativeSnapshot,
	AuthoritativeSubmitErrorCode,
	AuthoritativeSubmitResult,
	AuthoritativeTick,
	ClientEventProposal,
	CollaborationResumeErrorCode,
	CollaborationResumePlan,
	CollaborationResumeRequest,
	SnapshotChecksum,
} from './protocol.ts'

export const COLLABORATION_WIRE_VERSION = 1

export type CollaborationClientWireMessage =
	| {
		readonly wireVersion: typeof COLLABORATION_WIRE_VERSION
		readonly type: 'resume'
		readonly request: CollaborationResumeRequest
	}
	| {
		readonly wireVersion: typeof COLLABORATION_WIRE_VERSION
		readonly type: 'submit'
		readonly proposal: ClientEventProposal
	}

export type CollaborationWireErrorCode =
	| 'MALFORMED_MESSAGE'
	| 'RESUME_REQUIRED'
	| 'PARTICIPANT_MISMATCH'
	| 'SERVER_ERROR'

export type CollaborationServerWireMessage<Input> =
	| {
		readonly wireVersion: typeof COLLABORATION_WIRE_VERSION
		readonly type: 'resume-plan'
		readonly plan: CollaborationResumePlan<Input>
	}
	| {
		readonly wireVersion: typeof COLLABORATION_WIRE_VERSION
		readonly type: 'submit-result'
		readonly result: AuthoritativeSubmitResult<Input>
	}
	| {
		readonly wireVersion: typeof COLLABORATION_WIRE_VERSION
		readonly type: 'authoritative-event'
		readonly event: AuthoritativeEvent<Input>
	}
	| {
		readonly wireVersion: typeof COLLABORATION_WIRE_VERSION
		readonly type: 'authoritative-tick'
		readonly tick: AuthoritativeTick
	}
	| {
		readonly wireVersion: typeof COLLABORATION_WIRE_VERSION
		readonly type: 'error'
		readonly code: CollaborationWireErrorCode
		readonly error: string
	}

interface WireSnapshot {
	readonly protocolVersion: number
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly lastAppliedSequence: number
	readonly stepIndex: number
	readonly configurationBase64Url: string
	readonly stateBase64Url: string
	readonly checksum: SnapshotChecksum
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
	Object.prototype.hasOwnProperty.call(record, key)

const isSafeInteger = (value: unknown): value is number =>
	typeof value === 'number' && Number.isSafeInteger(value)

const isNonNegativeSafeInteger = (value: unknown): value is number =>
	isSafeInteger(value) && value >= 0

const parseJsonRecord = (text: string): Result<Record<string, unknown>, string> => {
	try {
		const value: unknown = JSON.parse(text)
		return isRecord(value)
			? { ok: true, value }
			: { ok: false, error: 'Collaboration wire message must be a JSON object.' }
	} catch {
		return { ok: false, error: 'Collaboration wire message is not valid JSON.' }
	}
}

const bytesToBase64Url = (bytes: Uint8Array): string => {
	let binary = ''
	const chunkSize = 0x8000
	for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength)))
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '')
}

const base64UrlToBytes = (value: string): Result<Uint8Array, string> => {
	if (!/^[A-Za-z0-9_-]*$/u.test(value) || value.length % 4 === 1) {
		return { ok: false, error: 'Snapshot byte payload is not canonical base64url.' }
	}
	const padding = '='.repeat((4 - value.length % 4) % 4)
	try {
		const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + padding)
		const bytes = new Uint8Array(binary.length)
		for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
		if (bytesToBase64Url(bytes) !== value) {
			return { ok: false, error: 'Snapshot byte payload is not canonical base64url.' }
		}
		return { ok: true, value: bytes }
	} catch {
		return { ok: false, error: 'Snapshot byte payload is not valid base64url.' }
	}
}

const snapshotToWire = (snapshot: AuthoritativeSnapshot): WireSnapshot => ({
	protocolVersion: snapshot.protocolVersion,
	roomId: snapshot.roomId,
	experimentId: snapshot.experimentId,
	stateVersion: snapshot.stateVersion,
	lastAppliedSequence: snapshot.lastAppliedSequence,
	stepIndex: snapshot.stepIndex,
	configurationBase64Url: bytesToBase64Url(snapshot.configurationBytes),
	stateBase64Url: bytesToBase64Url(snapshot.stateBytes),
	checksum: snapshot.checksum,
})

const validChecksum = (value: unknown): value is SnapshotChecksum => {
	if (!isRecord(value)) return false
	return value.algorithm === SNAPSHOT_CHECKSUM_ALGORITHM
		&& value.encodingVersion === CANONICAL_SNAPSHOT_ENCODING_VERSION
		&& typeof value.value === 'string'
		&& /^[0-9a-f]{64}$/u.test(value.value)
}

const wireToSnapshot = (value: unknown): Result<AuthoritativeSnapshot, string> => {
	if (!isRecord(value)
		|| value.protocolVersion !== COLLABORATION_PROTOCOL_VERSION
		|| typeof value.roomId !== 'string'
		|| typeof value.experimentId !== 'string'
		|| !isNonNegativeSafeInteger(value.stateVersion)
		|| !isNonNegativeSafeInteger(value.lastAppliedSequence)
		|| !isNonNegativeSafeInteger(value.stepIndex)
		|| typeof value.configurationBase64Url !== 'string'
		|| typeof value.stateBase64Url !== 'string'
		|| !validChecksum(value.checksum)) {
		return { ok: false, error: 'Authoritative snapshot wire payload is malformed.' }
	}
	const configurationBytes = base64UrlToBytes(value.configurationBase64Url)
	if (!configurationBytes.ok) return configurationBytes
	const stateBytes = base64UrlToBytes(value.stateBase64Url)
	if (!stateBytes.ok) return stateBytes
	return {
		ok: true,
		value: {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: value.roomId,
			experimentId: value.experimentId,
			stateVersion: value.stateVersion,
			lastAppliedSequence: value.lastAppliedSequence,
			stepIndex: value.stepIndex,
			configurationBytes: configurationBytes.value,
			stateBytes: stateBytes.value,
			checksum: value.checksum,
		},
	}
}

const parseResumeRequest = (value: unknown): Result<CollaborationResumeRequest, string> => {
	if (!isRecord(value)) return { ok: false, error: 'Collaboration resume request is malformed.' }
	const checksum = value.checksum
	if (typeof value.protocolVersion !== 'number'
		|| typeof value.roomId !== 'string'
		|| typeof value.experimentId !== 'string'
		|| typeof value.stateVersion !== 'number'
		|| typeof value.lastAppliedSequence !== 'number'
		|| typeof value.stepIndex !== 'number'
		|| (hasOwn(value, 'checksum') && checksum !== undefined && !validChecksum(checksum))) {
		return { ok: false, error: 'Collaboration resume request is malformed.' }
	}
	const base = {
		protocolVersion: value.protocolVersion,
		roomId: value.roomId,
		experimentId: value.experimentId,
		stateVersion: value.stateVersion,
		lastAppliedSequence: value.lastAppliedSequence,
		stepIndex: value.stepIndex,
	}
	if (checksum !== undefined) {
		if (!validChecksum(checksum)) return { ok: false, error: 'Collaboration resume request is malformed.' }
		return { ok: true, value: { ...base, checksum } }
	}
	return {
		ok: true,
		value: base,
	}
}

const parseProposal = (value: unknown): Result<ClientEventProposal, string> => {
	if (!isRecord(value)
		|| typeof value.protocolVersion !== 'number'
		|| typeof value.roomId !== 'string'
		|| typeof value.participantId !== 'string'
		|| typeof value.clientEventId !== 'string'
		|| typeof value.knownSequence !== 'number'
		|| !hasOwn(value, 'input')) {
		return { ok: false, error: 'Collaboration event proposal is malformed.' }
	}
	return {
		ok: true,
		value: {
			protocolVersion: value.protocolVersion,
			roomId: value.roomId,
			participantId: value.participantId,
			clientEventId: value.clientEventId,
			knownSequence: value.knownSequence,
			input: value.input,
		},
	}
}

export const encodeClientCollaborationWireMessage = (message: CollaborationClientWireMessage): string =>
	JSON.stringify(message)

export const parseClientCollaborationWireMessage = (text: string): Result<CollaborationClientWireMessage, string> => {
	const parsed = parseJsonRecord(text)
	if (!parsed.ok) return parsed
	if (parsed.value.wireVersion !== COLLABORATION_WIRE_VERSION || typeof parsed.value.type !== 'string') {
		return { ok: false, error: 'Collaboration client wire envelope is incompatible or malformed.' }
	}
	if (parsed.value.type === 'resume') {
		const request = parseResumeRequest(parsed.value.request)
		return request.ok
			? { ok: true, value: { wireVersion: COLLABORATION_WIRE_VERSION, type: 'resume', request: request.value } }
			: request
	}
	if (parsed.value.type === 'submit') {
		const proposal = parseProposal(parsed.value.proposal)
		return proposal.ok
			? { ok: true, value: { wireVersion: COLLABORATION_WIRE_VERSION, type: 'submit', proposal: proposal.value } }
			: proposal
	}
	return { ok: false, error: `Unknown collaboration client message type '${parsed.value.type}'.` }
}

const resumeErrorCodes = new Set<CollaborationResumeErrorCode>([
	'PROTOCOL_VERSION_MISMATCH',
	'ROOM_MISMATCH',
	'EXPERIMENT_MISMATCH',
	'STATE_VERSION_MISMATCH',
	'INVALID_SEQUENCE',
	'INVALID_STEP_INDEX',
	'AHEAD_OF_AUTHORITY',
])

const submitErrorCodes = new Set<AuthoritativeSubmitErrorCode>([
	'PROTOCOL_VERSION_MISMATCH',
	'ROOM_MISMATCH',
	'INVALID_IDENTITY',
	'INVALID_SEQUENCE',
	'AHEAD_OF_AUTHORITY',
	'INVALID_INPUT',
	'INPUT_TOO_LARGE',
	'RATE_LIMIT_EXCEEDED',
	'UNAUTHORIZED',
	'IDEMPOTENCY_CONFLICT',
])

const wireErrorCodes = new Set<CollaborationWireErrorCode>([
	'MALFORMED_MESSAGE',
	'RESUME_REQUIRED',
	'PARTICIPANT_MISMATCH',
	'SERVER_ERROR',
])

const parseAuthoritativeEvent = <Input>(value: unknown): Result<AuthoritativeEvent<Input>, string> => {
	if (!isRecord(value)
		|| value.protocolVersion !== COLLABORATION_PROTOCOL_VERSION
		|| typeof value.roomId !== 'string'
		|| typeof value.experimentId !== 'string'
		|| !isNonNegativeSafeInteger(value.stateVersion)
		|| typeof value.participantId !== 'string'
		|| typeof value.clientEventId !== 'string'
		|| !isNonNegativeSafeInteger(value.sequence)
		|| !isNonNegativeSafeInteger(value.stepIndex)
		|| !hasOwn(value, 'input')) {
		return { ok: false, error: 'Authoritative event wire payload is malformed.' }
	}
	return {
		ok: true,
		value: {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: value.roomId,
			experimentId: value.experimentId,
			stateVersion: value.stateVersion,
			participantId: value.participantId,
			clientEventId: value.clientEventId,
			sequence: value.sequence,
			stepIndex: value.stepIndex,
			input: value.input as Input,
		},
	}
}

const parseAuthoritativeTick = (value: unknown): Result<AuthoritativeTick, string> => {
	if (!isRecord(value)
		|| value.protocolVersion !== COLLABORATION_PROTOCOL_VERSION
		|| typeof value.roomId !== 'string'
		|| typeof value.experimentId !== 'string'
		|| !isNonNegativeSafeInteger(value.stateVersion)
		|| !isNonNegativeSafeInteger(value.stepIndex)
		|| !isNonNegativeSafeInteger(value.logHeadSequence)
		|| !isNonNegativeSafeInteger(value.appliedSequence)) {
		return { ok: false, error: 'Authoritative tick wire payload is malformed.' }
	}
	return {
		ok: true,
		value: {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: value.roomId,
			experimentId: value.experimentId,
			stateVersion: value.stateVersion,
			stepIndex: value.stepIndex,
			logHeadSequence: value.logHeadSequence,
			appliedSequence: value.appliedSequence,
		},
	}
}

const parseResumePlan = <Input>(value: unknown): Result<CollaborationResumePlan<Input>, string> => {
	if (!isRecord(value) || typeof value.ok !== 'boolean') {
		return { ok: false, error: 'Collaboration resume plan wire payload is malformed.' }
	}
	if (!value.ok) {
		if (typeof value.code !== 'string' || !resumeErrorCodes.has(value.code as CollaborationResumeErrorCode)
			|| typeof value.error !== 'string') {
			return { ok: false, error: 'Collaboration resume error wire payload is malformed.' }
		}
		return {
			ok: true,
			value: { ok: false, code: value.code as CollaborationResumeErrorCode, error: value.error },
		}
	}
	if (value.mode !== 'replay' && value.mode !== 'snapshot') {
		return { ok: false, error: 'Collaboration resume mode is malformed.' }
	}
	if (!Array.isArray(value.events)) return { ok: false, error: 'Collaboration resume events are malformed.' }
	const events: AuthoritativeEvent<Input>[] = []
	for (const rawEvent of value.events) {
		const event = parseAuthoritativeEvent<Input>(rawEvent)
		if (!event.ok) return event
		events.push(event.value)
	}
	const tick = parseAuthoritativeTick(value.tick)
	if (!tick.ok) return tick
	if (value.mode === 'replay') {
		return { ok: true, value: { ok: true, mode: 'replay', events, tick: tick.value } }
	}
	const snapshot = wireToSnapshot(value.snapshot)
	if (!snapshot.ok) return snapshot
	return { ok: true, value: { ok: true, mode: 'snapshot', snapshot: snapshot.value, events, tick: tick.value } }
}

const parseSubmitResult = <Input>(value: unknown): Result<AuthoritativeSubmitResult<Input>, string> => {
	if (!isRecord(value) || typeof value.ok !== 'boolean') {
		return { ok: false, error: 'Collaboration submit result wire payload is malformed.' }
	}
	if (!value.ok) {
		if (typeof value.code !== 'string' || !submitErrorCodes.has(value.code as AuthoritativeSubmitErrorCode)
			|| typeof value.error !== 'string') {
			return { ok: false, error: 'Collaboration submit error wire payload is malformed.' }
		}
		return {
			ok: true,
			value: { ok: false, code: value.code as AuthoritativeSubmitErrorCode, error: value.error },
		}
	}
	if (typeof value.duplicate !== 'boolean') {
		return { ok: false, error: 'Collaboration submit success wire payload is malformed.' }
	}
	const event = parseAuthoritativeEvent<Input>(value.event)
	if (!event.ok) return event
	return { ok: true, value: { ok: true, event: event.value, duplicate: value.duplicate } }
}

const serverMessageToJsonValue = <Input>(message: CollaborationServerWireMessage<Input>): unknown => {
	if (message.type !== 'resume-plan' || !message.plan.ok || message.plan.mode !== 'snapshot') return message
	return {
		...message,
		plan: {
			...message.plan,
			snapshot: snapshotToWire(message.plan.snapshot),
		},
	}
}

export const encodeServerCollaborationWireMessage = <Input>(message: CollaborationServerWireMessage<Input>): string =>
	JSON.stringify(serverMessageToJsonValue(message))

export const parseServerCollaborationWireMessage = <Input = unknown>(
	text: string,
): Result<CollaborationServerWireMessage<Input>, string> => {
	const parsed = parseJsonRecord(text)
	if (!parsed.ok) return parsed
	if (parsed.value.wireVersion !== COLLABORATION_WIRE_VERSION || typeof parsed.value.type !== 'string') {
		return { ok: false, error: 'Collaboration server wire envelope is incompatible or malformed.' }
	}
	if (parsed.value.type === 'resume-plan') {
		const plan = parseResumePlan<Input>(parsed.value.plan)
		return plan.ok
			? { ok: true, value: { wireVersion: COLLABORATION_WIRE_VERSION, type: 'resume-plan', plan: plan.value } }
			: plan
	}
	if (parsed.value.type === 'submit-result') {
		const result = parseSubmitResult<Input>(parsed.value.result)
		return result.ok
			? { ok: true, value: { wireVersion: COLLABORATION_WIRE_VERSION, type: 'submit-result', result: result.value } }
			: result
	}
	if (parsed.value.type === 'authoritative-event') {
		const event = parseAuthoritativeEvent<Input>(parsed.value.event)
		return event.ok
			? { ok: true, value: { wireVersion: COLLABORATION_WIRE_VERSION, type: 'authoritative-event', event: event.value } }
			: event
	}
	if (parsed.value.type === 'authoritative-tick') {
		const tick = parseAuthoritativeTick(parsed.value.tick)
		return tick.ok
			? { ok: true, value: { wireVersion: COLLABORATION_WIRE_VERSION, type: 'authoritative-tick', tick: tick.value } }
			: tick
	}
	if (parsed.value.type === 'error') {
		if (typeof parsed.value.code !== 'string'
			|| !wireErrorCodes.has(parsed.value.code as CollaborationWireErrorCode)
			|| typeof parsed.value.error !== 'string') {
			return { ok: false, error: 'Collaboration wire error payload is malformed.' }
		}
		return {
			ok: true,
			value: {
				wireVersion: COLLABORATION_WIRE_VERSION,
				type: 'error',
				code: parsed.value.code as CollaborationWireErrorCode,
				error: parsed.value.error,
			},
		}
	}
	return { ok: false, error: `Unknown collaboration server message type '${parsed.value.type}'.` }
}
