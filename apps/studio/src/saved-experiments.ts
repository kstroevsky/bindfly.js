import type { Result } from '../../../src-v2/core/result.ts'
import {
	canonicalStringify,
	parseStudioImportDocument,
} from './studio-state.ts'
import type { StudioDurableState, StudioExportDocument } from './studio-state.ts'

export const SAVED_EXPERIMENTS_FORMAT = 'bindfly-saved-experiments'
export const SAVED_EXPERIMENTS_VERSION = 1
export const SAVED_EXPERIMENTS_STORAGE_KEY = 'bindfly-studio.saved-experiments.v1'
export const MAX_SAVED_EXPERIMENTS = 24

export interface SavedExperimentRecord {
	readonly id: string
	readonly name: string
	readonly createdAt: string
	readonly updatedAt: string
	readonly document: StudioExportDocument
}

export interface SavedExperimentCollection {
	readonly format: typeof SAVED_EXPERIMENTS_FORMAT
	readonly version: typeof SAVED_EXPERIMENTS_VERSION
	readonly records: readonly SavedExperimentRecord[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const validIsoDate = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value))

const validateSavedRecord = (value: unknown): Result<SavedExperimentRecord, string> => {
	if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0 || value.id.length > 128) {
		return { ok: false, error: 'Saved experiment requires a bounded non-empty ID.' }
	}
	if (typeof value.name !== 'string' || value.name.trim().length === 0 || value.name.length > 120) {
		return { ok: false, error: 'Saved experiment requires a name of at most 120 characters.' }
	}
	if (!validIsoDate(value.createdAt) || !validIsoDate(value.updatedAt)) {
		return { ok: false, error: 'Saved experiment timestamps are invalid.' }
	}
	try {
		const parsed = parseStudioImportDocument(canonicalStringify(value.document))
		if (!parsed.ok) return { ok: false, error: `Saved experiment state is invalid: ${parsed.error}` }
		return {
			ok: true,
			value: Object.freeze({
				id: value.id,
				name: value.name.trim(),
				createdAt: value.createdAt,
				updatedAt: value.updatedAt,
				document: value.document as StudioExportDocument,
			}),
		}
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : 'Saved experiment state is malformed.' }
	}
}

export const createEmptySavedExperimentCollection = (): SavedExperimentCollection => Object.freeze({
	format: SAVED_EXPERIMENTS_FORMAT,
	version: SAVED_EXPERIMENTS_VERSION,
	records: Object.freeze([]),
})

export const parseSavedExperimentCollection = (value: unknown): Result<SavedExperimentCollection, string> => {
	let decoded = value
	if (typeof decoded === 'string') {
		try { decoded = JSON.parse(decoded) as unknown } catch { return { ok: false, error: 'Saved experiment collection is not valid JSON.' } }
	}
	if (!isRecord(decoded) || decoded.format !== SAVED_EXPERIMENTS_FORMAT || decoded.version !== SAVED_EXPERIMENTS_VERSION) {
		return { ok: false, error: 'Saved experiment collection format/version is unsupported.' }
	}
	if (!Array.isArray(decoded.records) || decoded.records.length > MAX_SAVED_EXPERIMENTS) {
		return { ok: false, error: `Saved experiment collection may contain at most ${MAX_SAVED_EXPERIMENTS} records.` }
	}
	const records: SavedExperimentRecord[] = []
	const ids = new Set<string>()
	for (const candidate of decoded.records) {
		const parsed = validateSavedRecord(candidate)
		if (!parsed.ok) return parsed
		if (ids.has(parsed.value.id)) return { ok: false, error: `Duplicate saved experiment ID '${parsed.value.id}'.` }
		ids.add(parsed.value.id)
		records.push(parsed.value)
	}
	return { ok: true, value: Object.freeze({
		format: SAVED_EXPERIMENTS_FORMAT,
		version: SAVED_EXPERIMENTS_VERSION,
		records: Object.freeze(records),
	}) }
}

export const createSavedExperimentRecord = (options: {
	readonly id: string
	readonly name: string
	readonly document: StudioExportDocument
	readonly now?: Date
}): SavedExperimentRecord => {
	const timestamp = (options.now ?? new Date()).toISOString()
	const parsed = validateSavedRecord({
		id: options.id,
		name: options.name,
		createdAt: timestamp,
		updatedAt: timestamp,
		document: options.document,
	})
	if (!parsed.ok) throw new Error(parsed.error)
	return parsed.value
}

export const upsertSavedExperiment = (
	collection: SavedExperimentCollection,
	record: SavedExperimentRecord,
): SavedExperimentCollection => {
	const existing = collection.records.find((item) => item.id === record.id)
	const nextRecord = existing
		? Object.freeze({ ...record, createdAt: existing.createdAt })
		: record
	const records = [nextRecord, ...collection.records.filter((item) => item.id !== record.id)]
		.slice(0, MAX_SAVED_EXPERIMENTS)
	return Object.freeze({ ...collection, records: Object.freeze(records) })
}

export const removeSavedExperiment = (
	collection: SavedExperimentCollection,
	id: string,
): SavedExperimentCollection => Object.freeze({
	...collection,
	records: Object.freeze(collection.records.filter((record) => record.id !== id)),
})

export const resolveSavedExperiment = (record: SavedExperimentRecord): Result<StudioDurableState, string> =>
	parseStudioImportDocument(canonicalStringify(record.document))

export const serializeSavedExperimentCollection = (collection: SavedExperimentCollection): string =>
	canonicalStringify(collection)

export interface SavedExperimentStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
}

export const readSavedExperiments = (storage: SavedExperimentStorage): SavedExperimentCollection => {
	const stored = storage.getItem(SAVED_EXPERIMENTS_STORAGE_KEY)
	if (!stored) return createEmptySavedExperimentCollection()
	const parsed = parseSavedExperimentCollection(stored)
	return parsed.ok ? parsed.value : createEmptySavedExperimentCollection()
}

export const writeSavedExperiments = (
	storage: SavedExperimentStorage,
	collection: SavedExperimentCollection,
): void => {
	storage.setItem(SAVED_EXPERIMENTS_STORAGE_KEY, serializeSavedExperimentCollection(collection))
}
