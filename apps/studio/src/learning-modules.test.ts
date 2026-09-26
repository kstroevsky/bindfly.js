import assert from 'node:assert/strict'
import test from 'node:test'

import { flyingLinesPlugin } from './flying-lines-plugin.ts'
import { parametricOriginalPlugins } from './parametric-original-plugin.ts'
import { evaluateLearningChallenge, listLearningModules } from './learning-modules.ts'

test('learning modules are gated by proven experiment capabilities', () => {
	assert.deepEqual(listLearningModules(flyingLinesPlugin).map(({ id }) => id), ['freeze-and-step'])
	const pulse = parametricOriginalPlugins.find(({ id }) => id === 'pulse-2023')
	assert.ok(pulse)
	assert.deepEqual(listLearningModules(pulse).map(({ id }) => id), [
		'freeze-and-step', 'formula-perturbation', 'connectivity-at-scale', 'parameter-sweep',
	])
})

test('educational challenge completion depends on validated evidence', () => {
	assert.equal(evaluateLearningChallenge('freeze-and-step', {
		paused: true, singleStepCount: 1, formulaTrailLength: 0,
	}), 'complete')
	assert.equal(evaluateLearningChallenge('formula-perturbation', {
		paused: true, singleStepCount: 0, formulaTrailLength: 2,
	}), 'complete')
	assert.equal(evaluateLearningChallenge('connectivity-at-scale', {
		paused: false, singleStepCount: 0, formulaTrailLength: 0,
		analysis: { beta0: 2 } as never,
	}), 'in-progress')
	assert.equal(evaluateLearningChallenge('connectivity-at-scale', {
		paused: false, singleStepCount: 0, formulaTrailLength: 0,
		analysis: { beta0: 1 } as never,
	}), 'complete')
})
