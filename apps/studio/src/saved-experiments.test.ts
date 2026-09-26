import assert from 'node:assert/strict'
import test from 'node:test'

import { createStudioDurableState, createStudioExportDocument } from './studio-state.ts'
import { flyingLinesPlugin } from './flying-lines-plugin.ts'
import {
	createEmptySavedExperimentCollection,
	createSavedExperimentRecord,
	parseSavedExperimentCollection,
	readSavedExperiments,
	removeSavedExperiment,
	resolveSavedExperiment,
	serializeSavedExperimentCollection,
	upsertSavedExperiment,
	writeSavedExperiments,
} from './saved-experiments.ts'

const createRecord = (id: string, name = id) => {
	const configuration = createStudioDurableState(
		flyingLinesPlugin,
		flyingLinesPlugin.defaultParameters,
		flyingLinesPlugin.defaultSeed,
		'main',
	)
	return createSavedExperimentRecord({
		id,
		name,
		document: createStudioExportDocument(flyingLinesPlugin, configuration),
		now: new Date('2026-09-26T10:00:00.000Z'),
	})
}

test('saved experiments round-trip through the existing Studio import contract', () => {
	const record = createRecord('fixture', 'Flying Lines fixture')
	const collection = upsertSavedExperiment(createEmptySavedExperimentCollection(), record)
	const parsed = parseSavedExperimentCollection(serializeSavedExperimentCollection(collection))
	assert.equal(parsed.ok, true)
	const resolved = resolveSavedExperiment(record)
	assert.equal(resolved.ok, true)
	if (resolved.ok) assert.equal(resolved.value.experiment.experimentId, flyingLinesPlugin.id)
})

test('saved experiment replacement preserves creation time and removal is explicit', () => {
	const original = createRecord('same', 'First')
	const updated = { ...createRecord('same', 'Second'), updatedAt: '2026-09-26T11:00:00.000Z' }
	let collection = upsertSavedExperiment(createEmptySavedExperimentCollection(), original)
	collection = upsertSavedExperiment(collection, updated)
	assert.equal(collection.records.length, 1)
	assert.equal(collection.records[0]?.name, 'Second')
	assert.equal(collection.records[0]?.createdAt, original.createdAt)
	assert.equal(collection.records[0]?.updatedAt, updated.updatedAt)
	assert.equal(removeSavedExperiment(collection, 'same').records.length, 0)
})

test('browser storage adapter fails closed to an empty collection on corrupt local data', () => {
	let value: string | null = null
	const storage = {
		getItem: () => value,
		setItem: (_key: string, next: string) => { value = next },
	}
	const collection = upsertSavedExperiment(createEmptySavedExperimentCollection(), createRecord('stored'))
	writeSavedExperiments(storage, collection)
	assert.equal(readSavedExperiments(storage).records[0]?.id, 'stored')
	value = '{broken'
	assert.deepEqual(readSavedExperiments(storage), createEmptySavedExperimentCollection())
})

test('saved collection rejects forged or malformed embedded export documents', () => {
	const record = createRecord('bad')
	const forged = {
		format: 'bindfly-saved-experiments',
		version: 1,
		records: [{ ...record, document: { ...record.document, version: 999 } }],
	}
	assert.equal(parseSavedExperimentCollection(forged).ok, false)
})
