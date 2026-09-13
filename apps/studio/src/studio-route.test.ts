import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultStudioRoute, isStudioRoute } from './studio-route.ts'

test('routes every registered experiment and recognized legacy migration through the generic Studio', () => {
	assert.equal(defaultStudioRoute, '#/lab/flying-lines')
	assert.equal(isStudioRoute(new URL('https://example.test/#/lab/flying-lines')), true)
	assert.equal(isStudioRoute(new URL('https://example.test/#/lab/drooping-lines')), true)
	assert.equal(isStudioRoute(new URL('https://example.test/#/DroopingLines-Simple')), true)
	assert.equal(isStudioRoute(new URL('https://example.test/#/Pulse-Simple')), false)
	assert.equal(isStudioRoute(new URL('https://example.test/#/lab/missing')), false)
})
