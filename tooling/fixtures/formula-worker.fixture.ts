import { parentPort } from 'node:worker_threads'

import { evaluateFormulaExperiment, parseFormulaExperiment } from '../../src-v2/formula/index.ts'

if (!parentPort) throw new Error('Formula worker fixture requires a parent port.')

parentPort.on('message', (message: unknown) => {
	if (typeof message !== 'object' || message === null || Array.isArray(message)) {
		parentPort.postMessage({ ok: false, error: 'Worker message must be an object.' })
		return
	}
	const record = message as Record<string, unknown>
	const experiment = parseFormulaExperiment(record.experiment)
	if (!experiment.ok) { parentPort.postMessage(experiment); return }
	if (typeof record.scope !== 'object' || record.scope === null || Array.isArray(record.scope)) {
		parentPort.postMessage({ ok: false, error: 'Worker scope must be an object.' })
		return
	}
	parentPort.postMessage(evaluateFormulaExperiment(
		experiment.value,
		record.scope as Readonly<Record<string, number>>,
	))
})
