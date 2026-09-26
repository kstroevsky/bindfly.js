import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultStudioRoute, isStudioRoute } from './studio-route.ts'

test('routes every registered experiment and recognized legacy migration through the generic Studio', () => {
	assert.equal(defaultStudioRoute, '#/lab/flying-lines')
	assert.equal(isStudioRoute(new URL('https://example.test/#/lab/flying-lines')), true)
	assert.equal(isStudioRoute(new URL('https://example.test/#/lab/drooping-lines')), true)
	assert.equal(isStudioRoute(new URL('https://example.test/#/DroopingLines-Simple')), true)
	assert.equal(isStudioRoute(new URL('https://example.test/#/Pulse-Simple')), true)
	for (const id of ['pulse-2023', 'spiral-1', 'spiral-2', 'spiral-3']) {
		assert.equal(isStudioRoute(new URL(`https://example.test/#/lab/${id}`)), true)
	}
	assert.equal(isStudioRoute(new URL('https://example.test/#/lab/vector-field-2d')), true)
	assert.equal(isStudioRoute(new URL('https://example.test/#/lab/discrete-map-2d')), true)
	assert.equal(isStudioRoute(new URL('https://example.test/#/lab/scalar-field-2d')), true)
	assert.equal(isStudioRoute(new URL('https://example.test/#/lab/missing')), false)
})
