import assert from 'node:assert/strict'
import test from 'node:test'

import {
	SEEDED_RANDOM_ALGORITHM,
	createSeededRandom,
	restoreSeededRandom,
} from './random.ts'

test('seeded random repeats the same sequence', () => {
	const first = createSeededRandom('bindfly')
	const second = createSeededRandom('bindfly')

	assert.equal(SEEDED_RANDOM_ALGORITHM, 'xmur3-mulberry32-v1')
	assert.deepEqual(
		Array.from({ length: 8 }, () => first.next()),
		Array.from({ length: 8 }, () => second.next()),
	)
})

test('seeded random preserves the versioned golden sequence', () => {
	const random = createSeededRandom('bindfly')
	assert.deepEqual(
		Array.from({ length: 4 }, () => random.next()),
		[
			0.3236439733300358,
			0.3067812183871865,
			0.4717146335169673,
			0.662124558351934,
		],
	)
})

test('seeded random separates different seeds and stays in range', () => {
	const first = createSeededRandom('bindfly-a')
	const second = createSeededRandom('bindfly-b')
	const firstValues = Array.from({ length: 32 }, () => first.next())
	const secondValues = Array.from({ length: 32 }, () => second.next())

	assert.notDeepEqual(firstValues, secondValues)
	assert.ok(firstValues.every((value) => value >= 0 && value < 1))
})

test('seeded random resumes exactly from a snapshot', () => {
	const random = createSeededRandom(42)
	random.next()
	random.next()
	const snapshot = random.snapshot()
	const expected = Array.from({ length: 6 }, () => random.next())
	const restored = restoreSeededRandom(snapshot)

	assert.deepEqual(Array.from({ length: 6 }, () => restored.next()), expected)
})

test('seeded random produces bounded values for explicit ranges', () => {
	const random = createSeededRandom('range')
	const values = Array.from({ length: 32 }, () => random.nextBetween(-2, 3))

	assert.ok(values.every((value) => value >= -2 && value < 3))
	assert.throws(() => random.nextBetween(1, 1), /ascending bounds/)
})
