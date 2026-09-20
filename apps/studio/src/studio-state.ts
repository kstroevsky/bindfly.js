import type { Result } from '../../../src-v2/core/result.ts'
import { createVersionedStateEnvelope, parseVersionedStateEnvelope } from '../../../src-v2/core/state-codec.ts'
import { getStudioExperimentPlugin, listStudioExperimentPlugins } from './studio-experiment-registry.ts'
import type { StudioExperimentPlugin, StudioParameterValues, StudioProvenanceEntry } from './studio-experiment-plugin.ts'
import type { StudioRuntimeKind } from './studio-controller.ts'

export const STUDIO_STATE_FORMAT = 'bindfly-studio'
export const STUDIO_STATE_FORMAT_VERSION = 1
export const STUDIO_STATE_QUERY_KEY = 's'
export const DEFAULT_URL_BUDGET = 1800
export const STUDIO_EXPORT_FORMAT = 'bindfly-studio-export'
export const STUDIO_EXPORT_VERSION = 1

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

export interface StudioExportDocument {
	readonly format: typeof STUDIO_EXPORT_FORMAT
	readonly version: typeof STUDIO_EXPORT_VERSION
	readonly configuration: StudioDurableState
	readonly provenance: readonly StudioProvenanceEntry[]
}

export interface ResolvedStudioState {
	readonly experimentId: string
	readonly parameters: StudioParameterValues
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

export const createStudioExportDocument = (
	plugin: StudioExperimentPlugin,
	configuration: StudioDurableState,
): StudioExportDocument => {
	if (configuration.experiment.experimentId !== plugin.id) {
		throw new Error(`Cannot export '${configuration.experiment.experimentId}' with plugin '${plugin.id}'.`)
	}
	return {
		format: STUDIO_EXPORT_FORMAT,
		version: STUDIO_EXPORT_VERSION,
		configuration,
		provenance: plugin.provenance,
	}
}

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
	plugin: StudioExperimentPlugin,
	parameters: unknown,
	seed: string,
	runtime: StudioRuntimeKind,
): StudioDurableState => ({
	format: STUDIO_STATE_FORMAT,
	formatVersion: STUDIO_STATE_FORMAT_VERSION,
	experiment: createVersionedStateEnvelope({
		experimentId: plugin.id,
		stateVersion: plugin.stateVersion,
		payload: plugin.serializeConfiguration(parameters, seed),
	}),
	renderer: 'canvas2d',
	runtime,
})

const runtimeFrom = (value: unknown): StudioRuntimeKind | undefined =>
	value === 'worker' ? 'worker' : value === 'main' ? 'main' : undefined

const migrateFormatZero = (value: Record<string, unknown>): Result<StudioDurableState, string> => {
	if (typeof value.experimentId !== 'string' || typeof value.seed !== 'string' || !isRecord(value.parameters)) {
		return { ok: false, error: 'Studio state version 0 is malformed.' }
	}
	const runtime = runtimeFrom(value.runtime)
	if (!runtime) return { ok: false, error: 'Studio state version 0 runtime is malformed.' }
	const plugin = getStudioExperimentPlugin(value.experimentId)
	if (!plugin) return { ok: false, error: `Experiment '${value.experimentId}' is unsupported.` }
	try {
		return { ok: true, value: createStudioDurableState(plugin, value.parameters, value.seed, runtime) }
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : 'Studio state version 0 is invalid.' }
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
	const runtime = runtimeFrom(value.runtime)
	if (value.renderer !== 'canvas2d' || !runtime) return { ok: false, error: 'Studio renderer or runtime is unsupported.' }
	const envelope = parseVersionedStateEnvelope(value.experiment)
	if (!envelope.ok) return envelope
	if (typeof envelope.value.payload !== 'string') return { ok: false, error: 'Experiment state payload must be a string.' }
	const plugin = getStudioExperimentPlugin(envelope.value.experimentId)
	if (!plugin) return { ok: false, error: `Experiment '${envelope.value.experimentId}' is unsupported.` }
	const configuration = plugin.parseConfiguration(envelope.value.payload, envelope.value.stateVersion)
	if (!configuration.ok) return configuration
	return {
		ok: true,
		value: createStudioDurableState(plugin, configuration.value.parameters, configuration.value.seed, runtime),
	}
}

export const parseStudioImportDocument = (serialized: unknown): Result<StudioDurableState, string> => {
	let value: unknown = serialized
	if (typeof serialized === 'string') {
		try { value = JSON.parse(serialized) as unknown } catch { return { ok: false, error: 'Studio import is not valid JSON.' } }
	}
	if (!isRecord(value) || value.format !== STUDIO_EXPORT_FORMAT) return parseStudioDurableState(value)
	if (value.version !== STUDIO_EXPORT_VERSION) {
		return { ok: false, error: `Studio export version '${String(value.version)}' is unsupported.` }
	}
	const configuration = parseStudioDurableState(value.configuration)
	if (!configuration.ok) return configuration
	const plugin = getStudioExperimentPlugin(configuration.value.experiment.experimentId)
	if (!plugin) return { ok: false, error: 'Studio export references an unsupported experiment.' }
	try {
		if (canonicalStringify(value.provenance) !== canonicalStringify(plugin.provenance)) {
			return { ok: false, error: 'Studio export provenance does not match the registered experiment.' }
		}
	} catch {
		return { ok: false, error: 'Studio export provenance is malformed.' }
	}
	return configuration
}

export const resolveStudioDurableState = (state: StudioDurableState): Result<ResolvedStudioState, string> => {
	const plugin = getStudioExperimentPlugin(state.experiment.experimentId)
	if (!plugin) return { ok: false, error: `Experiment '${state.experiment.experimentId}' is unsupported.` }
	const parsed = plugin.parseConfiguration(state.experiment.payload, state.experiment.stateVersion)
	return parsed.ok
		? { ok: true, value: { experimentId: plugin.id, parameters: parsed.value.parameters, seed: parsed.value.seed, runtime: state.runtime } }
		: parsed
}

export const migrateLegacyUrl = (url: URL): Result<ResolvedStudioState | undefined, string> => {
	for (const plugin of listStudioExperimentPlugins()) {
		const migrated = plugin.migrateLegacyUrl?.(url)
		if (!migrated) continue
		if (!migrated.ok) return migrated
		return {
			ok: true,
			value: {
				experimentId: plugin.id,
				parameters: migrated.value.parameters,
				seed: migrated.value.seed,
				runtime: 'main',
				migratedFrom: url.hash,
			},
		}
	}
	return { ok: true, value: undefined }
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
	url.hash = `/lab/${state.experiment.experimentId}`
	url.searchParams.delete('runtime')
	url.searchParams.set(STUDIO_STATE_QUERY_KEY, encodeStudioState(state))
	const serialized = url.toString()
	return serialized.length <= urlBudget
		? { kind: 'url', url: serialized }
		: { kind: 'json', json: canonicalStringify(state), reason: `State URL exceeds ${urlBudget} characters.` }
}
