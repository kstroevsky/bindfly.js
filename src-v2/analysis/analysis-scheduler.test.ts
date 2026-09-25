import assert from 'node:assert/strict'
import test from 'node:test'

import { AnalysisScheduler } from './analysis-scheduler.ts'

test('supersedes older analysis and accepts only the active request result', async () => {
	const scheduler = new AnalysisScheduler()
	let releaseFirst: (() => void) | undefined
	const first = scheduler.schedule({
		snapshotId: 'snapshot-1', analyzerId: 'fixture', analyzerVersion: '1', parameters: { epsilon: 10 },
		execute: (signal) => new Promise<{ value: number; sampleCount: number; inputCount: number }>((resolve, reject) => {
			releaseFirst = () => signal.aborted ? reject(signal.reason) : resolve({ value: 10, sampleCount: 5, inputCount: 5 })
			signal.addEventListener('abort', () => reject(signal.reason), { once: true })
		}),
	})
	const second = scheduler.schedule({
		snapshotId: 'snapshot-1', analyzerId: 'fixture', analyzerVersion: '1', parameters: { epsilon: 20 },
		execute: async () => ({ value: 20, sampleCount: 5, inputCount: 5, warnings: ['fixture'] }),
	})
	releaseFirst?.()
	const [firstOutcome, secondOutcome] = await Promise.all([first, second])
	assert.equal(firstOutcome.status, 'superseded')
	assert.equal(secondOutcome.status, 'completed')
	if (secondOutcome.status === 'completed') {
		assert.equal(secondOutcome.result.snapshotId, 'snapshot-1')
		assert.deepEqual(secondOutcome.result.parameters, { epsilon: 20 })
		assert.equal(secondOutcome.result.value, 20)
		assert.deepEqual(secondOutcome.result.warnings, ['fixture'])
	}
	scheduler.dispose()
})
