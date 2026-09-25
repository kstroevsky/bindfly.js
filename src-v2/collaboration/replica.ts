import { createSnapshotChecksum, encodeCanonicalSnapshotV1, snapshotChecksumsEqual } from './canonical-snapshot.ts'
import { COLLABORATION_PROTOCOL_VERSION } from './protocol.ts'
import type {
	AuthoritativeEvent,
	AuthoritativeSnapshot,
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
	private lastAppliedSequence = 0
	private stepIndex = 0

	constructor(options: CollaborationReplicaOptions<Input>) {
		this.roomId = options.roomId
		this.experimentId = options.experimentId
		this.stateVersion = options.stateVersion
		this.adapter = options.adapter
	}

	get lastSequence(): number {
		return this.lastAppliedSequence
	}

	get currentStepIndex(): number {
		return this.stepIndex
	}

	private result(status: ReplicaReceiveResult['status']): ReplicaReceiveResult {
		return { status, lastSequence: this.lastAppliedSequence, stepIndex: this.stepIndex }
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
		if (event.stepIndex !== this.stepIndex) return false
		this.adapter.applyInput(event.input)
		this.lastAppliedSequence = event.sequence
		return true
	}

	private drain(): boolean {
		let applied = false
		let draining = true
		while (draining) {
			const next = this.pending.get(this.lastAppliedSequence + 1)
			if (!next || next.stepIndex !== this.stepIndex) {
				draining = false
				continue
			}
			this.pending.delete(next.sequence)
			this.applyContiguous(next)
			applied = true
		}
		return applied
	}

	receive(event: AuthoritativeEvent<unknown>): ReplicaReceiveResult {
		if (!this.validEnvelope(event)) return this.result('needs-resync')
		if (event.sequence <= this.lastAppliedSequence) return this.result('ignored-old')

		const parsed = this.adapter.parseInput(event.input)
		if (!parsed.ok) return this.result('needs-resync')
		const typedEvent: AuthoritativeEvent<Input> = { ...event, input: parsed.value }
		if (typedEvent.stepIndex < this.stepIndex) return this.result('needs-resync')

		const expectedSequence = this.lastAppliedSequence + 1
		if (typedEvent.sequence !== expectedSequence) {
			const existing = this.pending.get(typedEvent.sequence)
			if (existing) {
				const existingBytes = this.adapter.encodeInput(existing.input)
				const receivedBytes = this.adapter.encodeInput(typedEvent.input)
				if (!bytesEqual(existingBytes, receivedBytes)
					|| existing.participantId !== typedEvent.participantId
					|| existing.clientEventId !== typedEvent.clientEventId
					|| existing.stepIndex !== typedEvent.stepIndex) return this.result('needs-resync')
			}
			this.pending.set(typedEvent.sequence, typedEvent)
			return this.result('buffered-gap')
		}

		if (typedEvent.stepIndex > this.stepIndex) {
			this.pending.set(typedEvent.sequence, typedEvent)
			return this.result('buffered-step')
		}

		this.applyContiguous(typedEvent)
		this.drain()
		return this.result('applied')
	}

	advanceStepIndex(nextStepIndex: number): Result<void, string> {
		if (!Number.isSafeInteger(nextStepIndex) || nextStepIndex < this.stepIndex) {
			return { ok: false, error: 'Replica step index must advance monotonically.' }
		}
		const nextEvent = this.pending.get(this.lastAppliedSequence + 1)
		if (nextEvent && nextEvent.stepIndex < nextStepIndex) {
			return { ok: false, error: 'Replica cannot advance past a pending authoritative event.' }
		}
		this.stepIndex = nextStepIndex
		this.drain()
		return { ok: true, value: undefined }
	}

	async compareSnapshot(snapshot: AuthoritativeSnapshot): Promise<DivergenceEvidence> {
		const localBytes = encodeCanonicalSnapshotV1({
			roomId: this.roomId,
			experimentId: this.experimentId,
			stateVersion: this.stateVersion,
			lastSequence: this.lastAppliedSequence,
			stepIndex: this.stepIndex,
			configurationBytes: this.adapter.captureConfigurationBytes(),
			stateBytes: this.adapter.captureStateBytes(),
		})
		const replicaChecksum = await createSnapshotChecksum(localBytes)
		return {
			matches: snapshotChecksumsEqual(snapshot.checksum, replicaChecksum),
			authoritativeChecksum: snapshot.checksum,
			replicaChecksum,
			authoritativeLastSequence: snapshot.lastSequence,
			replicaLastSequence: this.lastAppliedSequence,
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
		if (!bytesEqual(snapshot.configurationBytes, this.adapter.captureConfigurationBytes())) {
			return { ok: false, error: 'Authoritative snapshot configuration does not match this replica.' }
		}
		const canonicalBytes = encodeCanonicalSnapshotV1({
			roomId: snapshot.roomId,
			experimentId: snapshot.experimentId,
			stateVersion: snapshot.stateVersion,
			lastSequence: snapshot.lastSequence,
			stepIndex: snapshot.stepIndex,
			configurationBytes: snapshot.configurationBytes,
			stateBytes: snapshot.stateBytes,
		})
		const checksum = await createSnapshotChecksum(canonicalBytes)
		if (!snapshotChecksumsEqual(snapshot.checksum, checksum)) {
			return { ok: false, error: 'Authoritative snapshot checksum verification failed.' }
		}

		this.adapter.restoreStateBytes(snapshot.stateBytes.slice())
		this.lastAppliedSequence = snapshot.lastSequence
		this.stepIndex = snapshot.stepIndex
		this.pending.clear()
		return { ok: true, value: undefined }
	}
}
