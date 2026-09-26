import { createSnapshotChecksum, encodeCanonicalSnapshotV1, snapshotChecksumsEqual } from './canonical-snapshot.ts'
import { COLLABORATION_PROTOCOL_VERSION } from './protocol.ts'
import type {
	AuthoritativeEvent,
	AuthoritativeSnapshot,
	AuthoritativeSyncPoint,
	AuthoritativeTick,
	CollaborationResumeRequest,
	CollaborationResumePlan,
	CollaborationStateAdapter,
	DivergenceEvidence,
	ReplicaReceiveResult,
} from './protocol.ts'
import type { Result } from '../core/result.ts'

export interface CollaborationReplicaOptions<Input> {
	readonly roomId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly adapter: CollaborationStateAdapter<Input>
}

const bytesEqual = (left: Uint8Array, right: Uint8Array): boolean => {
	if (left.byteLength !== right.byteLength) return false
	for (let index = 0; index < left.byteLength; index++) {
		if (left[index] !== right[index]) return false
	}
	return true
}

export class CollaborationReplica<Input> {
	private readonly roomId: string
	private readonly experimentId: string
	private readonly stateVersion: number
	private readonly adapter: CollaborationStateAdapter<Input>
	private readonly pending = new Map<number, AuthoritativeEvent<Input>>()
	private lastAppliedSequenceValue = 0
	private stepIndex = 0
	private authoritativeTick: AuthoritativeTick | undefined
	private pendingSyncPoint: AuthoritativeSyncPoint | undefined
	private needsResynchronization = false

	constructor(options: CollaborationReplicaOptions<Input>) {
		this.roomId = options.roomId
		this.experimentId = options.experimentId
		this.stateVersion = options.stateVersion
		this.adapter = options.adapter
	}

	get lastAppliedSequence(): number {
		return this.lastAppliedSequenceValue
	}

	get currentStepIndex(): number {
		return this.stepIndex
	}

	get requiresResynchronization(): boolean {
		return this.needsResynchronization
	}

	private result(status: ReplicaReceiveResult['status']): ReplicaReceiveResult {
		return { status, lastAppliedSequence: this.lastAppliedSequenceValue, stepIndex: this.stepIndex }
	}

	private validEnvelope(event: AuthoritativeEvent<unknown>): boolean {
		return event.protocolVersion === COLLABORATION_PROTOCOL_VERSION
			&& event.roomId === this.roomId
			&& event.experimentId === this.experimentId
			&& event.stateVersion === this.stateVersion
			&& Number.isSafeInteger(event.sequence)
			&& event.sequence > 0
			&& Number.isSafeInteger(event.stepIndex)
			&& event.stepIndex >= 0
	}

	private applyContiguous(event: AuthoritativeEvent<Input>): boolean {
		if (event.stepIndex > this.stepIndex) return false
		this.adapter.applyInput(event.input)
		this.lastAppliedSequenceValue = event.sequence
		return true
	}

	private drain(): boolean {
		let applied = false
		let draining = true
		while (draining) {
			const next = this.pending.get(this.lastAppliedSequenceValue + 1)
			if (!next
				|| !this.authoritativeTick
				|| next.sequence > this.authoritativeTick.appliedSequence
				|| next.stepIndex > this.stepIndex) {
				draining = false
				continue
			}
			this.pending.delete(next.sequence)
			this.applyContiguous(next)
			applied = true
		}
		return applied
	}

	private hasCompletePrefix(sequence: number): boolean {
		for (let expected = this.lastAppliedSequenceValue + 1; expected <= sequence; expected++) {
			if (!this.pending.has(expected)) return false
		}
		return true
	}

	private validatePendingPrefix(sequence: number, authoritativeStepIndex: number): Result<void, string> {
		let previousStepIndex = this.stepIndex
		for (let expected = this.lastAppliedSequenceValue + 1; expected <= sequence; expected++) {
			const event = this.pending.get(expected)
			if (!event) return { ok: false, error: 'Replica cannot advance while authoritative events are missing.' }
			if (event.stepIndex < previousStepIndex) {
				return { ok: false, error: 'Authoritative event scheduling regressed across the ordered event prefix.' }
			}
			if (event.stepIndex > authoritativeStepIndex) {
				return { ok: false, error: 'Authoritative tick claims an event was applied before its scheduled boundary.' }
			}
			previousStepIndex = event.stepIndex
		}
		return { ok: true, value: undefined }
	}

	private eventsEqual(left: AuthoritativeEvent<Input>, right: AuthoritativeEvent<Input>): boolean {
		return left.protocolVersion === right.protocolVersion
			&& left.roomId === right.roomId
			&& left.experimentId === right.experimentId
			&& left.stateVersion === right.stateVersion
			&& left.participantId === right.participantId
			&& left.clientEventId === right.clientEventId
			&& left.sequence === right.sequence
			&& left.stepIndex === right.stepIndex
			&& bytesEqual(this.adapter.encodeInput(left.input), this.adapter.encodeInput(right.input))
	}

	receive(event: AuthoritativeEvent<unknown>): ReplicaReceiveResult {
		if (this.needsResynchronization) return this.result('needs-resync')
		if (!this.validEnvelope(event)) return this.result('needs-resync')
		if (event.sequence <= this.lastAppliedSequenceValue) return this.result('ignored-old')

		const parsed = this.adapter.parseInput(event.input)
		if (!parsed.ok) return this.result('needs-resync')
		const typedEvent: AuthoritativeEvent<Input> = { ...event, input: parsed.value }
		if (typedEvent.stepIndex < this.stepIndex) return this.result('needs-resync')

		const existing = this.pending.get(typedEvent.sequence)
		if (existing) return this.result(this.eventsEqual(existing, typedEvent) ? 'buffered-step' : 'needs-resync')

		this.pending.set(typedEvent.sequence, typedEvent)
		const hasGap = !this.hasCompletePrefix(typedEvent.sequence)
		let applied = false
		if (this.authoritativeTick && this.hasCompletePrefix(this.authoritativeTick.appliedSequence)) {
			const prefix = this.validatePendingPrefix(this.authoritativeTick.appliedSequence, this.authoritativeTick.stepIndex)
			if (!prefix.ok) return this.result('needs-resync')
			applied = this.drain()
		}
		if (applied) return this.result('applied')
		return this.result(hasGap ? 'buffered-gap' : 'buffered-step')
	}

	receiveTick(tick: AuthoritativeTick): Result<void, string> {
		if (this.needsResynchronization) {
			return { ok: false, error: 'Replica requires authoritative resynchronization.' }
		}
		if (tick.protocolVersion !== COLLABORATION_PROTOCOL_VERSION
			|| tick.roomId !== this.roomId
			|| tick.experimentId !== this.experimentId
			|| tick.stateVersion !== this.stateVersion) {
			return { ok: false, error: 'Authoritative tick is incompatible with this replica.' }
		}
		if (!Number.isSafeInteger(tick.stepIndex) || tick.stepIndex < this.stepIndex
			|| !Number.isSafeInteger(tick.logHeadSequence) || tick.logHeadSequence < this.lastAppliedSequenceValue
			|| !Number.isSafeInteger(tick.appliedSequence) || tick.appliedSequence < this.lastAppliedSequenceValue
			|| tick.appliedSequence > tick.logHeadSequence) {
			return { ok: false, error: 'Authoritative tick contains invalid or regressive synchronization metadata.' }
		}
		if (this.authoritativeTick
			&& (tick.stepIndex < this.authoritativeTick.stepIndex
				|| tick.logHeadSequence < this.authoritativeTick.logHeadSequence
				|| tick.appliedSequence < this.authoritativeTick.appliedSequence)) {
			return { ok: false, error: 'Authoritative tick regressed relative to a previously accepted watermark.' }
		}
		if (tick.syncPoint) {
			if (tick.syncPoint.protocolVersion !== COLLABORATION_PROTOCOL_VERSION
				|| tick.syncPoint.roomId !== this.roomId
				|| tick.syncPoint.experimentId !== this.experimentId
				|| tick.syncPoint.stateVersion !== this.stateVersion
				|| tick.syncPoint.stepIndex !== tick.stepIndex
				|| tick.syncPoint.appliedSequence !== tick.appliedSequence) {
				return { ok: false, error: 'Authoritative tick contains an incompatible synchronization checkpoint.' }
			}
			this.pendingSyncPoint = tick.syncPoint
		}
		const prefixComplete = this.hasCompletePrefix(tick.appliedSequence)
		if (prefixComplete) {
			const prefix = this.validatePendingPrefix(tick.appliedSequence, tick.stepIndex)
			if (!prefix.ok) return prefix
		}
		this.authoritativeTick = tick
		if (prefixComplete) this.drain()
		return { ok: true, value: undefined }
	}

	canAdvanceStepIndex(nextStepIndex: number): Result<void, string> {
		if (this.needsResynchronization) {
			return { ok: false, error: 'Replica requires authoritative resynchronization.' }
		}
		if (!Number.isSafeInteger(nextStepIndex) || nextStepIndex < this.stepIndex || nextStepIndex > this.stepIndex + 1) {
			return { ok: false, error: 'Replica step index must advance monotonically one boundary at a time.' }
		}
		if (nextStepIndex === this.stepIndex) return { ok: true, value: undefined }
		if (!this.authoritativeTick || this.authoritativeTick.stepIndex < nextStepIndex) {
			return { ok: false, error: 'Replica cannot advance beyond the latest authoritative tick.' }
		}
		const prefix = this.validatePendingPrefix(this.authoritativeTick.appliedSequence, this.authoritativeTick.stepIndex)
		if (!prefix.ok) return prefix
		return { ok: true, value: undefined }
	}

	advanceStepIndex(nextStepIndex: number): Result<void, string> {
		const allowed = this.canAdvanceStepIndex(nextStepIndex)
		if (!allowed.ok) return allowed
		if (nextStepIndex === this.stepIndex) {
			this.drain()
			return { ok: true, value: undefined }
		}
		this.stepIndex = nextStepIndex
		this.drain()
		return { ok: true, value: undefined }
	}

	private async createLocalChecksum(): Promise<AuthoritativeSnapshot['checksum']> {
		const localBytes = encodeCanonicalSnapshotV1({
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			lastAppliedSequence: this.lastAppliedSequenceValue,
			stepIndex: this.stepIndex,
			configurationBytes: this.adapter.captureConfigurationBytes(),
			stateBytes: this.adapter.captureStateBytes(),
		})
		return createSnapshotChecksum(localBytes)
	}

	async createResumeRequest(): Promise<CollaborationResumeRequest> {
		return {
			protocolVersion: COLLABORATION_PROTOCOL_VERSION,
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			lastAppliedSequence: this.lastAppliedSequenceValue,
			stepIndex: this.stepIndex,
			checksum: await this.createLocalChecksum(),
		}
	}

	async verifyPendingSyncPoint(): Promise<Result<DivergenceEvidence | undefined, string>> {
		const syncPoint = this.pendingSyncPoint
		if (!syncPoint) return { ok: true, value: undefined }
		if (syncPoint.stepIndex !== this.stepIndex || syncPoint.appliedSequence !== this.lastAppliedSequenceValue) {
			return { ok: true, value: undefined }
		}
		const replicaChecksum = await this.createLocalChecksum()
		const evidence: DivergenceEvidence = {
			matches: snapshotChecksumsEqual(syncPoint.checksum, replicaChecksum),
			authoritativeChecksum: syncPoint.checksum,
			replicaChecksum,
			authoritativeLastAppliedSequence: syncPoint.appliedSequence,
			replicaLastAppliedSequence: this.lastAppliedSequenceValue,
			authoritativeStepIndex: syncPoint.stepIndex,
			replicaStepIndex: this.stepIndex,
		}
		this.pendingSyncPoint = undefined
		if (!evidence.matches) this.needsResynchronization = true
		return { ok: true, value: evidence }
	}

	async applyResumePlan(plan: CollaborationResumePlan<Input>): Promise<Result<void, string>> {
		if (!plan.ok) return { ok: false, error: plan.error }
		if (plan.mode === 'snapshot') {
			const resynchronized = await this.resynchronize(plan.snapshot)
			if (!resynchronized.ok) return resynchronized
		}
		for (const event of plan.events) {
			if (this.receive(event).status === 'needs-resync') {
				return { ok: false, error: 'Resume plan contains an event incompatible with replica state.' }
			}
		}
		return this.receiveTick(plan.tick)
	}

	async compareSnapshot(snapshot: AuthoritativeSnapshot): Promise<DivergenceEvidence> {
		const replicaChecksum = await this.createLocalChecksum()
		return {
			matches: snapshotChecksumsEqual(snapshot.checksum, replicaChecksum),
			authoritativeChecksum: snapshot.checksum,
			replicaChecksum,
			authoritativeLastAppliedSequence: snapshot.lastAppliedSequence,
			replicaLastAppliedSequence: this.lastAppliedSequenceValue,
			authoritativeStepIndex: snapshot.stepIndex,
			replicaStepIndex: this.stepIndex,
		}
	}

	async resynchronize(snapshot: AuthoritativeSnapshot): Promise<Result<void, string>> {
		if (snapshot.protocolVersion !== COLLABORATION_PROTOCOL_VERSION
			|| snapshot.roomId !== this.roomId
			|| snapshot.experimentId !== this.experimentId
			|| snapshot.stateVersion !== this.stateVersion) {
			return { ok: false, error: 'Authoritative snapshot is incompatible with this replica.' }
		}
		if (!Number.isSafeInteger(snapshot.lastAppliedSequence) || snapshot.lastAppliedSequence < 0
			|| !Number.isSafeInteger(snapshot.stepIndex) || snapshot.stepIndex < 0) {
			return { ok: false, error: 'Authoritative snapshot contains invalid synchronization metadata.' }
		}
		if (!bytesEqual(snapshot.configurationBytes, this.adapter.captureConfigurationBytes())) {
			return { ok: false, error: 'Authoritative snapshot configuration does not match this replica.' }
		}
		const canonicalBytes = encodeCanonicalSnapshotV1({
			roomId: snapshot.roomId,
			experimentId: snapshot.experimentId,
			stateVersion: snapshot.stateVersion,
			lastAppliedSequence: snapshot.lastAppliedSequence,
			stepIndex: snapshot.stepIndex,
			configurationBytes: snapshot.configurationBytes,
			stateBytes: snapshot.stateBytes,
		})
		const checksum = await createSnapshotChecksum(canonicalBytes)
		if (!snapshotChecksumsEqual(snapshot.checksum, checksum)) {
			return { ok: false, error: 'Authoritative snapshot checksum verification failed.' }
		}

		this.adapter.restoreStateBytes(snapshot.stateBytes.slice())
		this.lastAppliedSequenceValue = snapshot.lastAppliedSequence
		this.stepIndex = snapshot.stepIndex
		this.pending.clear()
		this.authoritativeTick = undefined
		this.pendingSyncPoint = undefined
		this.needsResynchronization = false
		return { ok: true, value: undefined }
	}
}
