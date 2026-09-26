import assert from 'node:assert/strict'
import test from 'node:test'

import { parseRipserPersistenceOutput } from './ripser-output.ts'

const close = (actual: number | null, expected: number | null, tolerance = 1e-6) => {
	if (actual === null || expected === null) {
		assert.equal(actual, expected)
		return
	}
	assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`)
}

const parse = (body: string) => parseRipserPersistenceOutput(body.trim().split('\n'))

test('parses Ripser H0/H1 output including right-censored intervals', () => {
	const result = parse(`
point cloud with 2 points in dimension 2
persistence intervals in dim 0:
 [0,2)
 [0, )
`)
	assert.deepEqual(result.h0, [{ birth: 0, death: 2 }, { birth: 0, death: null }])
	assert.deepEqual(result.h1, [])
})

test('Ripser square golden matches GUDHI 3.13.0 H0/H1', () => {
	const result = parse(`
persistence intervals in dim 0:
 [0,1)
 [0,1)
 [0,1)
 [0, )
persistence intervals in dim 1:
 [1,1.41421354)
`)
	assert.equal(result.h0.length, 4)
	assert.equal(result.h1.length, 1)
	close(result.h1[0]?.birth ?? null, 1)
	close(result.h1[0]?.death ?? null, Math.sqrt(2))
})

test('Ripser circle and figure-eight goldens match GUDHI 3.13.0 H1', () => {
	const circle = parse(`
persistence intervals in dim 0:
 [0,0.765366852)
 [0,0.765366852)
 [0,0.765366852)
 [0,0.765366852)
 [0,0.765366852)
 [0,0.765366852)
 [0,0.765366852)
 [0, )
persistence intervals in dim 1:
 [0.765366852,1.84775901)
`)
	assert.equal(circle.h0.length, 8)
	assert.equal(circle.h1.length, 1)
	close(circle.h1[0]?.birth ?? null, 0.76536686473018)
	close(circle.h1[0]?.death ?? null, 1.8477590650225735)

	const figureEight = parse(`
persistence intervals in dim 0:
 [0,0.707106769)
 [0,0.707106769)
 [0,0.707106769)
 [0,0.707106769)
 [0,0.707106769)
 [0,0.707106769)
 [0, )
persistence intervals in dim 1:
 [0.707106769,1)
 [0.707106769,1)
`)
	assert.equal(figureEight.h1.length, 2)
	for (const interval of figureEight.h1) {
		close(interval.birth, Math.SQRT1_2)
		close(interval.death, 1)
	}
})

test('rejects malformed finite intervals instead of inventing topology', () => {
	assert.throws(() => parse(`
persistence intervals in dim 1:
 [2,1)
`), /death 1 before birth 2/)
})
