export const RUNTIME_PROTOCOL_VERSION = 5

export type RuntimeFormulaView =
	| 'morph'
	| 'formula-a'
	| 'compare'
	| 'difference-vector'
	| 'difference-magnitude'
	| 'formula-b'

export interface RuntimePointInspectionRequest {
	readonly x: number
	readonly y: number
	readonly maxDistance?: number
}

export interface RuntimePointCloudCaptureRequest {
	readonly source: 'morph' | 'formula-a' | 'formula-b'
}

export type RuntimeCommandType =
	| 'initialize'
	| 'resize'
	| 'input'
	| 'parameters'
	| 'reset'
	| 'pause'
	| 'resume'
	| 'step'
	| 'formula-view'
	| 'inspect-point'
	| 'capture-point-cloud'
	| 'dispose'

export const runtimeCommandTypes: readonly RuntimeCommandType[] = [
	'initialize',
	'resize',
	'input',
	'parameters',
	'reset',
	'pause',
	'resume',
	'step',
	'formula-view',
	'inspect-point',
	'capture-point-cloud',
	'dispose',
]

export interface RuntimeCommand<Type extends RuntimeCommandType = RuntimeCommandType, Payload = unknown> {
	readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION
	readonly requestId: string
	readonly sequence: number
	readonly type: Type
	readonly payload: Payload
}

export type RuntimeEvent =
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'ready'; readonly requestId: string }
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'ack'; readonly requestId: string }
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'telemetry'; readonly payload: unknown }
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'inspection-result'; readonly requestId: string; readonly payload: unknown }
	| { readonly protocolVersion: typeof RUNTIME_PROTOCOL_VERSION; readonly type: 'point-cloud-snapshot'; readonly requestId: string; readonly payload: unknown }
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

export const isRuntimePointInspectionRequest = (value: unknown): value is RuntimePointInspectionRequest =>
	isRecord(value)
	&& typeof value.x === 'number' && Number.isFinite(value.x)
	&& typeof value.y === 'number' && Number.isFinite(value.y)
	&& (value.maxDistance === undefined
		|| (typeof value.maxDistance === 'number' && Number.isFinite(value.maxDistance) && value.maxDistance > 0))

export const isRuntimePointCloudCaptureRequest = (value: unknown): value is RuntimePointCloudCaptureRequest =>
	isRecord(value) && ['morph', 'formula-a', 'formula-b'].includes(String(value.source))

export const isRuntimeFormulaView = (value: unknown): value is RuntimeFormulaView =>
	typeof value === 'string'
	&& ['morph', 'formula-a', 'compare', 'difference-vector', 'difference-magnitude', 'formula-b'].includes(value)

export const isRuntimeCommand = (value: unknown): value is RuntimeCommand =>
	isRecord(value)
	&& value.protocolVersion === RUNTIME_PROTOCOL_VERSION
	&& typeof value.requestId === 'string'
	&& value.requestId.length > 0
	&& Number.isInteger(value.sequence)
	&& (value.sequence as number) >= 0
	&& typeof value.type === 'string'
	&& runtimeCommandTypes.includes(value.type as RuntimeCommandType)

export const isRuntimeEvent = (value: unknown): value is RuntimeEvent =>
	isRecord(value)
	&& value.protocolVersion === RUNTIME_PROTOCOL_VERSION
	&& typeof value.type === 'string'
	&& ['ready', 'ack', 'telemetry', 'inspection-result', 'point-cloud-snapshot', 'analysis-result', 'error', 'disposed'].includes(value.type)
