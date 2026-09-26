import assert from 'node:assert/strict'
import test from 'node:test'

import {
	RuntimeTransitionError,
	assertRuntimeTransition,
	canTransitionRuntime,
} from './lifecycle.ts'

test('allows the declared runtime lifecycle', () => {
	const transitions = [
		['idle', 'initializing'],
		['initializing', 'ready'],
		['ready', 'running'],
		['running', 'paused'],
		['paused', 'running'],
		['running', 'disposing'],
		['disposing', 'disposed'],
	] as const

	for (const [from, to] of transitions) {
		assert.equal(canTransitionRuntime(from, to), true)
		assert.doesNotThrow(() => assertRuntimeTransition(from, to))
	}
})

test('allows failure from active setup/runtime states and forbids resurrection', () => {
	for (const state of ['initializing', 'ready', 'running', 'paused'] as const) {
		assert.equal(canTransitionRuntime(state, 'failed'), true)
	}

	assert.equal(canTransitionRuntime('disposed', 'running'), false)
	assert.throws(
		() => assertRuntimeTransition('disposed', 'running'),
		(error) => error instanceof RuntimeTransitionError
	)
})
