import assert from 'node:assert/strict'
import test from 'node:test'

import { hslToNormalizedRgba, parseCssColorRgba, ReusableColoredVertexBuffer } from './common.ts'

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

test('reusable colored vertex staging preserves values and storage between frames', () => {
	const vertices = new ReusableColoredVertexBuffer(2)
	vertices.append(12, 34, [1, 0.5, 0.25, 0.75])
	vertices.append(56, 78, [0, 1, 0.5, 1])
	const firstBuffer = vertices.data.buffer
	assert.equal(vertices.vertexCount, 2)
	assert.deepEqual(Array.from(vertices.data), [12, 34, 1, 0.5, 0.25, 0.75, 56, 78, 0, 1, 0.5, 1])

	vertices.reset()
	vertices.append(90, 91, [0.25, 0.5, 0.75, 1])
	assert.equal(vertices.vertexCount, 1)
	assert.equal(vertices.data.buffer, firstBuffer)
	assert.deepEqual(Array.from(vertices.data), [90, 91, 0.25, 0.5, 0.75, 1])

	vertices.append(92, 93, [1, 1, 1, 1])
	vertices.append(94, 95, [0, 0, 0, 1])
	assert.equal(vertices.vertexCount, 3)
	assert.notEqual(vertices.data.buffer, firstBuffer)
})
