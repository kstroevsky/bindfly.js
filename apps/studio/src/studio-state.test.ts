import assert from 'node:assert/strict'
import test from 'node:test'

import { droopingLinesPlugin } from './drooping-lines-plugin.ts'
import { flyingLinesPlugin } from './flying-lines-plugin.ts'
import { parametricOriginalPlugins } from './parametric-original-plugin.ts'
import {
	canonicalStringify,
	createShareArtifact,
	createStudioConfiguration,
	createStudioDurableState,
	createStudioExportDocument,
	decodeStudioState,
	encodeStudioState,
	migrateLegacyUrl,
	parseStudioImportDocument,
	parseStudioDurableState,
	readStudioStateFromUrl,
	resolveStudioDurableState,
} from './studio-state.ts'

const parameters = flyingLinesPlugin.defaultParameters

test('canonical state round-trips deterministically through JSON and base64url', () => {
	const state = createStudioDurableState(flyingLinesPlugin, parameters, 'fixture-✓', 'worker')
	const encoded = encodeStudioState(state)
	assert.match(encoded, /^[A-Za-z0-9_-]+$/)
	assert.deepEqual(decodeStudioState(encoded), { ok: true, value: state })
	assert.equal(canonicalStringify({ b: 1, a: { d: 2, c: 3 } }), '{"a":{"c":3,"d":2},"b":1}')
	assert.equal(encodeStudioState(state), encoded)
})

test('current v2 Studio state migrates missing persistence epsilonMax to the durable default', () => {
	const state = createStudioDurableState(flyingLinesPlugin, parameters, 'fixture', 'main')
	const legacyV2 = JSON.parse(canonicalStringify(state)) as {
		studio: { analysis: { epsilonMax?: number } }
	}
	delete legacyV2.studio.analysis.epsilonMax
	const parsed = parseStudioDurableState(legacyV2)
	assert.equal(parsed.ok, true)
	if (!parsed.ok) return
	assert.equal(parsed.value.studio.analysis.epsilonMax, 1000)
})

test('current v2 Studio state preserves a supported WebGL2 main-thread renderer', () => {
	const state = createStudioDurableState(flyingLinesPlugin, parameters, 'webgl-fixture', 'main', {
		renderer: 'webgl2',
	})
	assert.equal(state.studio.renderer, 'webgl2')
	const parsed = parseStudioDurableState(canonicalStringify(state))
	assert.deepEqual(parsed, { ok: true, value: state })
	const resolved = resolveStudioDurableState(state)
	assert.equal(resolved.ok, true)
	if (resolved.ok) assert.equal(resolved.value.studio.renderer, 'webgl2')
})

test('Studio state rejects unsupported renderer/runtime execution profiles', () => {
	const webglState = createStudioDurableState(flyingLinesPlugin, parameters, 'webgl-fixture', 'main', {
		renderer: 'webgl2',
	})
	assert.equal(parseStudioDurableState({
		...webglState,
		studio: { ...webglState.studio, runtime: 'worker' },
	}).ok, false)

	const droopingState = createStudioDurableState(
		droopingLinesPlugin,
		droopingLinesPlugin.defaultParameters,
		droopingLinesPlugin.defaultSeed,
		'main',
	)
	assert.equal(parseStudioDurableState({
		...droopingState,
		studio: { ...droopingState.studio, renderer: 'webgl2' },
	}).ok, false)
})

test('URL state includes only durable choices and reproduces them', () => {
	const plugin = parametricOriginalPlugins[0]
	assert.ok(plugin)
	const state = createStudioDurableState(plugin, { ...plugin.defaultParameters, particleCount: 42 }, 'url-fixture', 'main', {
		workspace: 'analyze',
		analysis: { epsilon: 123, epsilonMax: 2000 },
	})
	const artifact = createShareArtifact(new URL(`https://example.test/?runtime=worker#/lab/${plugin.id}`), state)
	assert.equal(artifact.kind, 'url')
	if (artifact.kind !== 'url') return
	const resolved = readStudioStateFromUrl(new URL(artifact.url))
	assert.equal(resolved.ok, true)
	if (!resolved.ok || !resolved.value) return
	assert.equal(resolved.value.parameters.particleCount, 42)
	assert.equal(resolved.value.experimentId, plugin.id)
	assert.equal(resolved.value.seed, 'url-fixture')
	assert.equal(resolved.value.runtime, 'main')
	assert.equal(resolved.value.studio.workspace, 'analyze')
	assert.equal(resolved.value.studio.analysis.epsilon, 123)
	assert.equal(resolved.value.studio.analysis.epsilonMax, 2000)
	assert.equal(new URL(artifact.url).searchParams.has('runtime'), false)
	assert.doesNotMatch(artifact.url, /telemetry|paused|drag|ready/)
})

test('falls back to canonical JSON when the URL budget is exceeded', () => {
	const state = createStudioDurableState(flyingLinesPlugin, parameters, 'long-seed', 'main')
	const artifact = createShareArtifact(new URL('https://example.test/#/lab/flying-lines'), state, 20)
	assert.equal(artifact.kind, 'json')
	if (artifact.kind !== 'json') return
	assert.match(artifact.reason, /exceeds 20/)
	assert.deepEqual(parseStudioDurableState(artifact.json), { ok: true, value: state })
})

test('exports validated formula provenance while accepting legacy raw configuration imports', () => {
	const state = createStudioDurableState(
		droopingLinesPlugin,
		droopingLinesPlugin.defaultParameters,
		droopingLinesPlugin.defaultSeed,
		'main',
	)
	const exported = createStudioExportDocument(droopingLinesPlugin, state)
	assert.equal(exported.format, 'bindfly-studio-export')
	assert.deepEqual(exported.provenance.map(({ id }) => id), ['drooping-tan-x', 'drooping-atan-y'])
	assert.deepEqual(parseStudioImportDocument(canonicalStringify(exported)), { ok: true, value: state })
	assert.deepEqual(parseStudioImportDocument(canonicalStringify(state)), { ok: true, value: state })
	assert.equal(parseStudioImportDocument(canonicalStringify({
		...exported,
		provenance: [{ ...exported.provenance[0], legacyGitBlob: 'forged' }],
	})).ok, false)
})

test('rejects malformed, unknown, future, and invalid experiment state', () => {
	assert.equal(parseStudioDurableState('{').ok, false)
	assert.equal(parseStudioDurableState({ format: 'other', formatVersion: 1 }).ok, false)
	assert.equal(parseStudioDurableState({ ...createStudioDurableState(flyingLinesPlugin, parameters, 'x', 'main'), formatVersion: 99 }).ok, false)
	const future = createStudioDurableState(flyingLinesPlugin, parameters, 'x', 'main')
	assert.equal(parseStudioDurableState({ ...future, experiment: { ...future.experiment, stateVersion: 99 } }).ok, false)
	assert.equal(decodeStudioState('***').ok, false)
})

test('migrates the version-zero studio document', () => {
	const migrated = parseStudioDurableState({
		format: 'bindfly-studio',
		formatVersion: 0,
		experimentId: 'flying-lines',
		seed: 'v0-seed',
		parameters,
		runtime: 'worker',
	})
	assert.equal(migrated.ok, true)
	if (!migrated.ok) return
	const resolved = resolveStudioDurableState(migrated.value)
	assert.deepEqual(resolved, {
		ok: true,
		value: {
			experimentId: 'flying-lines', parameters, seed: 'v0-seed', runtime: 'worker',
			studio: createStudioConfiguration(flyingLinesPlugin, 'worker'),
		},
	})
})

test('migrates v1 formula presentation into Studio configuration and scrubs it from experiment state', () => {
	const oldParameters = { ...droopingLinesPlugin.defaultParameters, formulaView: 'compare' }
	const migrated = parseStudioDurableState({
		format: 'bindfly-studio',
		formatVersion: 1,
		experiment: {
			experimentId: droopingLinesPlugin.id,
			stateVersion: 2,
			payload: JSON.stringify({ parameters: oldParameters, seed: 'v1-formula-view' }),
		},
		renderer: 'canvas2d',
		runtime: 'main',
	})
	assert.equal(migrated.ok, true)
	if (!migrated.ok) return
	assert.equal(migrated.value.studio.workspace, 'compare')
	assert.equal(migrated.value.studio.formulaView, 'compare')
	const experimentOnly = droopingLinesPlugin.parseConfiguration(
		migrated.value.experiment.payload,
		migrated.value.experiment.stateVersion,
	)
	assert.equal(experimentOnly.ok, true)
	if (experimentOnly.ok) assert.equal(Object.hasOwn(experimentOnly.value.parameters, 'formulaView'), false)
	const resolved = resolveStudioDurableState(migrated.value)
	assert.equal(resolved.ok, true)
	if (resolved.ok) {
		assert.equal(Object.hasOwn(resolved.value.parameters, 'formulaView'), false)
		assert.equal(resolved.value.studio.formulaView, 'compare')
	}
})

test('migrates every recorded legacy Flying Lines preset URL and recognizes formula originals', () => {
	const expected = [
		['Simple', 100, 60, 250],
		['SwitchColor', 100, 120, 150],
		['Monochrome&Clickable', 100, 120, 150],
		['AddByClick', 100, 120, 200],
		['Blank', 1, 120, 200],
	] as const
	for (const [preset, count, speed, radius] of expected) {
		const migrated = migrateLegacyUrl(new URL(`https://example.test/#/FlyingLines-${preset}?bgColor=0.7`))
		assert.equal(migrated.ok, true)
		if (!migrated.ok || !migrated.value) continue
		assert.equal(migrated.value.parameters.particleCount, count)
		assert.equal(migrated.value.parameters.maxSpeed, speed)
		assert.equal(migrated.value.parameters.connectionRadius, radius)
		assert.equal(migrated.value.migratedFrom?.startsWith('#/FlyingLines-'), true)
	}
	assert.equal(migrateLegacyUrl(new URL('https://example.test/#/FlyingLines-Unknown')).ok, false)
	const pulse = migrateLegacyUrl(new URL('https://example.test/#/Pulse-Simple'))
	assert.equal(pulse.ok, true)
	if (!pulse.ok || !pulse.value) return
	assert.equal(pulse.value.experimentId, 'pulse-2023')
	assert.equal(pulse.value.parameters.formulaAX, 'positionX + distance * cos(a) * -1')
	assert.equal(pulse.value.parameters.particleCount, 100)
})

test('durable state and legacy migration are heterogeneous and plugin-driven', () => {
	const state = createStudioDurableState(droopingLinesPlugin, {
		...droopingLinesPlugin.defaultParameters,
		formulaMorph: 1,
	}, 'drooping-state', 'worker')
	const parsed = parseStudioDurableState(canonicalStringify(state))
	assert.equal(parsed.ok, true)
	if (!parsed.ok) return
	const resolved = resolveStudioDurableState(parsed.value)
	assert.equal(resolved.ok, true)
	if (!resolved.ok) return
	assert.equal(resolved.value.experimentId, 'drooping-lines')
	assert.equal(resolved.value.parameters.formulaMorph, 1)
	assert.equal(resolved.value.parameters.formulaBY, 'atan(y)')

	const legacy = migrateLegacyUrl(new URL('https://example.test/#/DroopingLines-AddByClick'))
	assert.equal(legacy.ok, true)
	if (!legacy.ok || !legacy.value) return
	assert.equal(legacy.value.experimentId, 'drooping-lines')
	assert.equal(legacy.value.parameters.formulaMorph, 1)
})
