import type { Result } from './result.ts'

export interface VersionedStateEnvelope<Payload = unknown> {
	readonly experimentId: string
	readonly stateVersion: number
	readonly payload: Payload
}

export interface StateMigrationContext {
	readonly experimentId: string
	readonly fromVersion: number
	readonly toVersion: number
}

export interface ExperimentStateCodec<State, SerializedState = unknown> {
	readonly currentVersion: number
	serialize(state: State): SerializedState
	parse(serialized: unknown): Result<State, string>
	migrate(serialized: unknown, context: StateMigrationContext): Result<unknown, string>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

export const createVersionedStateEnvelope = <Payload>(
	envelope: VersionedStateEnvelope<Payload>,
): VersionedStateEnvelope<Payload> => {
	if (envelope.experimentId.length === 0) {
		throw new Error('State envelope must include a non-empty experimentId.')
	}

	if (!Number.isInteger(envelope.stateVersion) || envelope.stateVersion <= 0) {
		throw new Error('State envelope must include a positive integer stateVersion.')
	}

	return envelope
}

export const parseVersionedStateEnvelope = (value: unknown): Result<VersionedStateEnvelope, string> => {
	if (
		!isRecord(value)
		|| typeof value.experimentId !== 'string'
		|| value.experimentId.length === 0
		|| !Number.isInteger(value.stateVersion)
		|| (value.stateVersion as number) <= 0
		|| !Object.hasOwn(value, 'payload')
	) {
		return {
			ok: false,
			error: 'State envelope must include a positive integer stateVersion and a payload.',
		}
	}

	return {
		ok: true,
		value: {
			experimentId: value.experimentId,
			stateVersion: value.stateVersion as number,
			payload: value.payload,
		},
	}
}
