import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { createPointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import { analyzeRipsComplex } from '../../../src-v2/analysis/rips-complex.ts'
import { countPersistenceIntervalsAt, DEFAULT_RIPS_PERSISTENCE_BUDGET } from '../../../src-v2/analysis/rips-persistence.ts'

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

test('checked-in Ripser worker artifact has the pinned SHA-256', async () => {
	const bytes = await readFile(new URL('./vendor/ripser-wasm.generated.mjs', import.meta.url))
	assert.equal(createHash('sha256').update(bytes).digest('hex'), EXPECTED_RIPSER_ARTIFACT_SHA256)
})

test('RipserWasmAdapter reproduces the GUDHI unit-square H0/H1 fixture', async () => {
	Object.defineProperty(globalThis, 'self', {
		value: { location: { href: import.meta.url } },
		configurable: true,
	})
	const { RipserWasmAdapter } = await import('./ripser-wasm-adapter.ts')
	const result = await new RipserWasmAdapter().compute(
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

test('static beta values agree with Ripser away from float filtration boundaries', async () => {
	Object.defineProperty(globalThis, 'self', {
		value: { location: { href: import.meta.url } },
		configurable: true,
	})
	const { RipserWasmAdapter } = await import('./ripser-wasm-adapter.ts')
	const square = snapshot([[0, 0], [1, 0], [1, 1], [0, 1]])
	const persistence = await new RipserWasmAdapter().compute(square, {
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
