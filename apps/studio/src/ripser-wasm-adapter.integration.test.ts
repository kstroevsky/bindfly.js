import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createPointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import { analyzeRipsComplex } from '../../../src-v2/analysis/rips-complex.ts'
import { countPersistenceIntervalsAt, DEFAULT_RIPS_PERSISTENCE_BUDGET } from '../../../src-v2/analysis/rips-persistence.ts'
import type { RipsPersistenceResult } from '../../../src-v2/analysis/rips-persistence.ts'

const EXPECTED_RIPSER_ARTIFACT_SHA256 = '0165efd5f9d299fb114621f68d1c4b9d7f8a01647ab54f6a282896f1daed4851'
const FLOAT_FILTRATION_BOUNDARY_TOLERANCE = 1e-6

const snapshot = (coordinates: readonly (readonly [number, number])[]) => createPointCloudSnapshot({
	snapshotId: 'ripser-fixture', experimentId: 'ripser-fixture', stateVersion: 1, simulationStep: 0,
	source: 'morph', formulaConfigurationHash: 'fixture',
	points: {
		count: coordinates.length,
		capacity: coordinates.length,
		ids: Uint32Array.from(coordinates, (_, index) => index),
		x: Float64Array.from(coordinates, ([x]) => x),
		y: Float64Array.from(coordinates, ([, y]) => y),
	},
})

const near = (actual: number | null, expected: number, tolerance = FLOAT_FILTRATION_BOUNDARY_TOLERANCE) => {
	assert.notEqual(actual, null)
	assert.ok(Math.abs((actual as number) - expected) <= tolerance, `${String(actual)} differs from ${expected}`)
}

const createRipserAdapter = async () => {
	Object.defineProperty(globalThis, 'self', {
		value: { location: { href: import.meta.url } },
		configurable: true,
	})
	const { RipserWasmAdapter } = await import('./ripser-wasm-adapter.ts')
	return new RipserWasmAdapter()
}

const assertPersistenceMatches = (
	result: RipsPersistenceResult,
	expectedH0Deaths: readonly number[],
	expectedH1: readonly (readonly [number, number])[],
) => {
	assert.equal(result.status, 'computed')
	assert.equal(result.h0.length, expectedH0Deaths.length + 1)
	assert.equal(result.h0.filter(({ death }) => death === null).length, 1)
	const actualH0Deaths = result.h0
		.flatMap(({ death }) => death === null ? [] : [death])
		.sort((left, right) => left - right)
	const sortedExpectedH0Deaths = [...expectedH0Deaths].sort((left, right) => left - right)
	for (let index = 0; index < sortedExpectedH0Deaths.length; index++) {
		near(actualH0Deaths[index] ?? null, sortedExpectedH0Deaths[index] as number)
	}
	assert.equal(result.h1.length, expectedH1.length)
	const actualH1 = [...result.h1].sort((left, right) => left.birth - right.birth || (left.death ?? Infinity) - (right.death ?? Infinity))
	const sortedExpectedH1 = [...expectedH1].sort((left, right) => left[0] - right[0] || left[1] - right[1])
	for (let index = 0; index < sortedExpectedH1.length; index++) {
		near(actualH1[index]?.birth ?? null, sortedExpectedH1[index]?.[0] as number)
		near(actualH1[index]?.death ?? null, sortedExpectedH1[index]?.[1] as number)
	}
}

test('checked-in Ripser worker artifact has the pinned SHA-256', async () => {
	const bytes = await readFile(new URL('./vendor/ripser-wasm.generated.mjs', import.meta.url))
	assert.equal(createHash('sha256').update(bytes).digest('hex'), EXPECTED_RIPSER_ARTIFACT_SHA256)
})

test('RipserWasmAdapter reproduces the GUDHI unit-square H0/H1 fixture', async () => {
	const result = await (await createRipserAdapter()).compute(
		snapshot([[0, 0], [1, 0], [1, 1], [0, 1]]),
		{
			epsilonMax: Math.SQRT2,
			maximumHomologyDimension: 1,
			coefficientField: 2,
			budget: DEFAULT_RIPS_PERSISTENCE_BUDGET,
		},
	)

	assert.equal(result.status, 'computed')
	assert.equal(result.h0.length, 4)
	assert.equal(result.h1.length, 1)
	near(result.h1[0]?.birth ?? null, 1)
	near(result.h1[0]?.death ?? null, Math.SQRT2)
})

const executableGudhiFixtures = [
	{
		name: '8-point circle',
		coordinates: Array.from({ length: 8 }, (_, index) => {
			const angle = 2 * Math.PI * index / 8
			return [Math.cos(angle), Math.sin(angle)] as const
		}),
		epsilonMax: 2,
		h0Deaths: Array(7).fill(0.7653668647301795) as number[],
		h1: [[0.7653668647301798, 1.8477590650225735]] as const,
	},
	{
		name: 'figure eight',
		coordinates: [
			[-1, 0], [-0.5, 0.5], [0, 0], [-0.5, -0.5],
			[0.5, 0.5], [1, 0], [0.5, -0.5],
		] as const,
		epsilonMax: 1.1,
		h0Deaths: Array(6).fill(Math.SQRT1_2) as number[],
		h1: [[Math.SQRT1_2, 1], [Math.SQRT1_2, 1]] as const,
	},
	{
		name: 'noisy circle',
		coordinates: [1, 1.08, 0.94, 1.04, 0.97, 1.06, 0.92, 1.03].map((radius, index) => {
			const angle = 2 * Math.PI * index / 8
			return [radius * Math.cos(angle), radius * Math.sin(angle)] as const
		}),
		epsilonMax: 2,
		h0Deaths: [
			0.7531209918036113,
			0.7633248465915821,
			0.7686734898341152,
			0.7719076099365919,
			0.7773416435234333,
			0.7812845929416398,
			0.7837667966167193,
		],
		h1: [[0.7994056245968358, 1.8479017209167157]] as const,
	},
] as const

for (const fixture of executableGudhiFixtures) {
	test(`RipserWasmAdapter reproduces the GUDHI 3.13.0 ${fixture.name} fixture`, async () => {
		const result = await (await createRipserAdapter()).compute(snapshot(fixture.coordinates), {
			epsilonMax: fixture.epsilonMax,
			maximumHomologyDimension: 1,
			coefficientField: 2,
			budget: DEFAULT_RIPS_PERSISTENCE_BUDGET,
		})
		assertPersistenceMatches(result, fixture.h0Deaths, fixture.h1)
	})
}

test('static beta values agree with Ripser away from float filtration boundaries', async () => {
	const square = snapshot([[0, 0], [1, 0], [1, 1], [0, 1]])
	const persistence = await (await createRipserAdapter()).compute(square, {
		epsilonMax: 2,
		maximumHomologyDimension: 1,
		coefficientField: 2,
		budget: DEFAULT_RIPS_PERSISTENCE_BUDGET,
	})

	for (const epsilon of [1.1, 1.5]) {
		const boundaries = [...persistence.h0, ...persistence.h1]
			.flatMap(({ birth, death }) => death === null ? [birth] : [birth, death])
		assert.ok(boundaries.every((boundary) => Math.abs(boundary - epsilon) > FLOAT_FILTRATION_BOUNDARY_TOLERANCE))
		const staticResult = analyzeRipsComplex(square, epsilon, {
			maxMaterializedTriangles: 50_000,
			maxTriangleCountForMaterialization: 500_000,
			maxHomologyTriangles: 50_000,
		})
		assert.equal(staticResult.beta1Status, 'computed')
		assert.equal(staticResult.beta0, countPersistenceIntervalsAt(persistence.h0, epsilon))
		assert.equal(staticResult.beta1, countPersistenceIntervalsAt(persistence.h1, epsilon))
	}
})
