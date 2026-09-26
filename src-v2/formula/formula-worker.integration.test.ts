import assert from 'node:assert/strict'
import test from 'node:test'
import { Worker } from 'node:worker_threads'

import { compileFormulaExperiment, serializeFormulaExperiment } from './index.ts'

test('serialized formula experiments execute across an isolated worker boundary', async () => {
	const compiled = compileFormulaExperiment({
		id: 'worker-formula-fixture',
		xSource: 'tan(x)',
		ySource: 'atan(y)',
		variables: ['x', 'y'],
	})
	assert.equal(compiled.ok, true)
	if (!compiled.ok) return

	const worker = new Worker(
		new URL('../../tooling/fixtures/formula-worker.fixture.ts', import.meta.url),
		{ execArgv: ['--experimental-strip-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'] },
	)
	try {
		const result = await new Promise<unknown>((resolve, reject) => {
			worker.once('message', resolve)
			worker.once('error', reject)
			worker.postMessage({
				experiment: serializeFormulaExperiment(compiled.value),
				scope: { x: 0.25, y: 2 },
			})
		})
		assert.deepEqual(result, {
			ok: true,
			value: { x: Math.tan(0.25), y: Math.atan(2) },
		})
	} finally {
		await worker.terminate()
	}
})
