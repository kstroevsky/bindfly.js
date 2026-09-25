import assert from 'node:assert/strict'
import test from 'node:test'

import { hslToNormalizedRgba, parseCssColorRgba } from './common.ts'

test('WebGL2 color parsing preserves supported Studio CSS backgrounds', () => {
	assert.deepEqual(parseCssColorRgba('#050508'), [5 / 255, 5 / 255, 8 / 255, 1])
	assert.deepEqual(parseCssColorRgba('#fff'), [1, 1, 1, 1])
	assert.deepEqual(parseCssColorRgba('rgba(255, 255, 0, 0.7)'), [1, 1, 0, 0.7])
	assert.deepEqual(parseCssColorRgba('rgb(0, 128, 255)'), [0, 128 / 255, 1, 1])
})

test('WebGL2 HSL conversion is deterministic and normalized', () => {
	assert.deepEqual(hslToNormalizedRgba(0, 1, 0.5, 0.25), [1, 0, 0, 0.25])
	assert.deepEqual(hslToNormalizedRgba(120, 1, 0.5), [0, 1, 0, 1])
})
