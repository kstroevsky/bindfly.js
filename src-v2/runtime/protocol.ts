export const RUNTIME_PROTOCOL_VERSION = 1

export type RuntimeCommandType =
	| 'initialize'
	| 'resize'
	| 'input'
	| 'parameters'
	| 'pause'
	| 'resume'
	| 'dispose'

export const runtimeCommandTypes: readonly RuntimeCommandType[] = [
	'initialize',
	'resize',
	'input',
	'parameters',
	'pause',
	'resume',
	'dispose',
]

export interface RuntimeCommand<Type extends RuntimeCommandType = RuntimeCommandType, Payload = unknown> {
	readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION
	readonly requestId: string
	readonly type: Type
	readonly payload: Payload
}

export type RuntimeEvent =
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'ready' }
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'ack'; readonly requestId: string }
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'telemetry'; readonly payload: unknown }
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'analysis-result'; readonly payload: unknown }
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'error'; readonly requestId?: string; readonly error: RuntimeErrorPayload }
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'disposed' }

export interface RuntimeErrorPayload {
	readonly code: string
	readonly message: string
	readonly recoverable: boolean
}

export const createRuntimeCommand = <Type extends RuntimeCommandType, Payload>(
	command: Omit<RuntimeCommand<Type, Payload>, 'protocolVersion'>,
): RuntimeCommand<Type, Payload> => ({
	...command,
	protocolVersion: RUNTIME_PROTOCOL_VERSION,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

export const isRuntimeCommand = (value: unknown): value is RuntimeCommand =>
	isRecord(value)
	&& value.protocolVersion === RUNTIME_PROTOCOL_VERSION
	&& typeof value.requestId === 'string'
	&& value.requestId.length > 0
	&& typeof value.type === 'string'
	&& runtimeCommandTypes.includes(value.type as RuntimeCommandType)
