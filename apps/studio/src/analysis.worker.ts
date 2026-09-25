import { analyzeRipsComplex, DEFAULT_RIPS_ANALYSIS_BUDGET } from '../../../src-v2/analysis/rips-complex.ts'
import { DEFAULT_RIPS_PERSISTENCE_BUDGET } from '../../../src-v2/analysis/rips-persistence.ts'
import { isAnalysisWorkerRequest } from './analysis-worker-protocol.ts'
import type { AnalysisWorkerResponse } from './analysis-worker-protocol.ts'
import { RipserWasmAdapter } from './ripser-wasm-adapter.ts'

interface AnalysisWorkerScope {
	postMessage(message: AnalysisWorkerResponse): void
}

const scope = self as unknown as AnalysisWorkerScope
const persistenceBackend = new RipserWasmAdapter()

self.onmessage = (event: MessageEvent<unknown>) => {
	if (!isAnalysisWorkerRequest(event.data)) return
	const request = event.data
	void (async () => {
		try {
		if (request.type === 'analyze-rips') {
			const result = analyzeRipsComplex(request.snapshot, request.epsilon, DEFAULT_RIPS_ANALYSIS_BUDGET)
			scope.postMessage({ type: 'rips-result', requestId: request.requestId, result })
		} else {
			const result = await persistenceBackend.compute(request.snapshot, {
				epsilonMax: request.epsilonMax,
				maximumHomologyDimension: 1,
				coefficientField: 2,
				budget: DEFAULT_RIPS_PERSISTENCE_BUDGET,
			})
			scope.postMessage({ type: 'persistence-result', requestId: request.requestId, result })
		}
		} catch (error) {
			scope.postMessage({
				type: 'analysis-error',
				requestId: request.requestId,
				message: error instanceof Error ? error.message : 'Point-cloud analysis failed.',
			})
		}
	})()
}
