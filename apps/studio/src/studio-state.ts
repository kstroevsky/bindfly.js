import type { ParameterValues } from '../../../src-v2/core/parameters.ts'
import type { Result } from '../../../src-v2/core/result.ts'
import { createVersionedStateEnvelope, parseVersionedStateEnvelope } from '../../../src-v2/core/state-codec.ts'
import { flyingLinesDefinition } from '../../../src-v2/effects/flying-lines/definition.ts'
import type { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import type { StudioRuntimeKind } from './studio-controller.ts'

export const STUDIO_STATE_FORMAT = 'bindfly-studio'
export const STUDIO_STATE_FORMAT_VERSION = 1
export const STUDIO_STATE_QUERY_KEY = 's'
export const DEFAULT_URL_BUDGET = 1800

export interface StudioDurableState {
	readonly format: typeof STUDIO_STATE_FORMAT
	readonly formatVersion: typeof STUDIO_STATE_FORMAT_VERSION
	readonly experiment: {
		readonly experimentId: string
		readonly stateVersion: number
		readonly payload: string
	}
	readonly renderer: 'canvas2d'
	readonly runtime: StudioRuntimeKind
}

export interface ResolvedStudioState {
	readonly parameters: ParameterValues<typeof flyingLinesParameters>
	readonly seed: string
	readonly runtime: StudioRuntimeKind
	readonly migratedFrom?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const canonicalize = (value: unknown, seen: Set<object>): unknown => {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new Error('Canonical state cannot contain non-finite numbers.')
		return value
	}
	if (Array.isArray(value)) return value.map((item) => canonicalize(item, seen))
	if (!isRecord(value)) throw new Error('Canonical state contains an unsupported value.')
	if (seen.has(value)) throw new Error('Canonical state cannot contain cycles.')
	seen.add(value)
	const result: Record<string, unknown> = {}
	for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key], seen)
	seen.delete(value)
	return result
}

export const canonicalStringify = (value: unknown): string =>
	JSON.stringify(canonicalize(value, new Set()))

const encodeBase64Url = (value: string): string => {
	const bytes = new TextEncoder().encode(value)
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
	let output = ''
	for (let index = 0; index < bytes.length; index += 3) {
		const first = bytes[index] ?? 0
		const second = bytes[index + 1]
		const third = bytes[index + 2]
		output += alphabet[first >> 2]
		output += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)]
		if (second !== undefined) output += alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)]
		if (third !== undefined) output += alphabet[third & 63]
	}
	return output
}

const decodeBase64Url = (value: string): Result<string, string> => {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) return { ok: false, error: 'State URL payload is not valid base64url.' }
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
	const bytes: number[] = []
	let buffer = 0
	let bits = 0
	for (const character of value) {
		const sextet = alphabet.indexOf(character)
		if (sextet < 0) return { ok: false, error: 'State URL payload is not valid base64url.' }
		buffer = (buffer << 6) | sextet
		bits += 6
		if (bits >= 8) {
			bits -= 8
			bytes.push((buffer >> bits) & 255)
		}
	}
	try {
		return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)) }
	} catch {
		return { ok: false, error: 'State URL payload is not valid UTF-8.' }
	}
}

export const createStudioDurableState = (
	parameters: ParameterValues<typeof flyingLinesParameters>,
	seed: string,
	runtime: StudioRuntimeKind,
): StudioDurableState => ({
	format: STUDIO_STATE_FORMAT,
	formatVersion: STUDIO_STATE_FORMAT_VERSION,
	experiment: createVersionedStateEnvelope({
		experimentId: flyingLinesDefinition.id,
		stateVersion: flyingLinesDefinition.stateVersion,
		payload: flyingLinesDefinition.stateCodec.serialize({ parameters, seed }),
	}),
	renderer: 'canvas2d',
	runtime,
})

const migrateFormatZero = (value: Record<string, unknown>): Result<StudioDurableState, string> => {
	if (value.experimentId !== 'flying-lines' || !isRecord(value.parameters) || typeof value.seed !== 'string') {
		return { ok: false, error: 'Studio state version 0 is malformed.' }
	}
	const parsed = flyingLinesDefinition.stateCodec.parse(JSON.stringify({ parameters: value.parameters, seed: value.seed }))
	if (!parsed.ok) return parsed
	return {
		ok: true,
		value: createStudioDurableState(parsed.value.parameters, parsed.value.seed, value.runtime === 'worker' ? 'worker' : 'main'),
	}
}

export const parseStudioDurableState = (serialized: unknown): Result<StudioDurableState, string> => {
	let value: unknown = serialized
	if (typeof serialized === 'string') {
		try { value = JSON.parse(serialized) as unknown } catch { return { ok: false, error: 'Studio state is not valid JSON.' } }
	}
	if (!isRecord(value)) return { ok: false, error: 'Studio state must be an object.' }
	if (value.format !== STUDIO_STATE_FORMAT) return { ok: false, error: 'Studio state format is unknown.' }
	if (value.formatVersion === 0) return migrateFormatZero(value)
	if (value.formatVersion !== STUDIO_STATE_FORMAT_VERSION) return { ok: false, error: `Studio state version '${String(value.formatVersion)}' is unsupported.` }
	if (value.renderer !== 'canvas2d' || (value.runtime !== 'main' && value.runtime !== 'worker')) {
		return { ok: false, error: 'Studio renderer or runtime is unsupported.' }
	}
	const envelope = parseVersionedStateEnvelope(value.experiment)
	if (!envelope.ok) return envelope
	if (envelope.value.experimentId !== flyingLinesDefinition.id) return { ok: false, error: `Experiment '${envelope.value.experimentId}' is unsupported.` }
	if (envelope.value.stateVersion > flyingLinesDefinition.stateVersion) return { ok: false, error: `Experiment state version ${envelope.value.stateVersion} is newer than supported version ${flyingLinesDefinition.stateVersion}.` }
	let payload = envelope.value.payload
	if (envelope.value.stateVersion < flyingLinesDefinition.stateVersion) {
		const migrated = flyingLinesDefinition.stateCodec.migrate(payload, {
			experimentId: flyingLinesDefinition.id,
			fromVersion: envelope.value.stateVersion,
			toVersion: flyingLinesDefinition.stateVersion,
		})
		if (!migrated.ok) return migrated
		payload = migrated.value
	}
	const experiment = flyingLinesDefinition.stateCodec.parse(payload)
	if (!experiment.ok) return experiment
	return { ok: true, value: createStudioDurableState(experiment.value.parameters, experiment.value.seed, value.runtime) }
}

export const resolveStudioDurableState = (state: StudioDurableState): Result<ResolvedStudioState, string> => {
	const parsed = flyingLinesDefinition.stateCodec.parse(state.experiment.payload)
	return parsed.ok
		? { ok: true, value: { parameters: parsed.value.parameters, seed: parsed.value.seed, runtime: state.runtime } }
		: parsed
}

const legacyPresets: Readonly<Record<string, ParameterValues<typeof flyingLinesParameters>>> = {
	Simple: { particleCount: 100, maxSpeed: 60, connectionRadius: 250, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(0, 0, 0, 0.7)' },
	SwitchColor: { particleCount: 100, maxSpeed: 120, connectionRadius: 150, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(255, 255, 0, 0.7)' },
	'Monochrome&Clickable': { particleCount: 100, maxSpeed: 120, connectionRadius: 150, particleLifetimeSeconds: 20, margin: 20, background: 'rgb(255, 255, 255)' },
	AddByClick: { particleCount: 100, maxSpeed: 120, connectionRadius: 200, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(0, 0, 0, 0.7)' },
	Blank: { particleCount: 1, maxSpeed: 120, connectionRadius: 200, particleLifetimeSeconds: 20, margin: 20, background: 'rgba(0, 0, 0, 0.7)' },
}

export const migrateLegacyUrl = (url: URL): Result<ResolvedStudioState | undefined, string> => {
	const match = /^#\/FlyingLines-([^?]+)(?:\?.*)?$/.exec(url.hash)
	if (!match) return { ok: true, value: undefined }
	const presetId = match[1]
	const parameters = presetId ? legacyPresets[presetId] : undefined
	if (!parameters) return { ok: false, error: `Legacy Flying Lines preset '${presetId ?? ''}' is unsupported.` }
	return {
		ok: true,
		value: { parameters, seed: `legacy-flying-lines-${presetId}`, runtime: 'main', migratedFrom: url.hash },
	}
}

export const encodeStudioState = (state: StudioDurableState): string =>
	encodeBase64Url(canonicalStringify(state))

export const decodeStudioState = (encoded: string): Result<StudioDurableState, string> => {
	const decoded = decodeBase64Url(encoded)
	return decoded.ok ? parseStudioDurableState(decoded.value) : decoded
}

export const readStudioStateFromUrl = (url: URL): Result<ResolvedStudioState | undefined, string> => {
	const encoded = url.searchParams.get(STUDIO_STATE_QUERY_KEY)
	if (!encoded) return migrateLegacyUrl(url)
	const decoded = decodeStudioState(encoded)
	if (!decoded.ok) return decoded
	return resolveStudioDurableState(decoded.value)
}

export type ShareArtifact =
	| { readonly kind: 'url'; readonly url: string }
	| { readonly kind: 'json'; readonly json: string; readonly reason: string }

export const createShareArtifact = (
	baseUrl: URL,
	state: StudioDurableState,
	urlBudget = DEFAULT_URL_BUDGET,
): ShareArtifact => {
	const url = new URL(baseUrl)
	url.hash = '/lab/flying-lines'
	url.searchParams.delete('runtime')
	url.searchParams.set(STUDIO_STATE_QUERY_KEY, encodeStudioState(state))
	const serialized = url.toString()
	return serialized.length <= urlBudget
		? { kind: 'url', url: serialized }
		: { kind: 'json', json: canonicalStringify(state), reason: `State URL exceeds ${urlBudget} characters.` }
}
