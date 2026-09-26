import type { PointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import type { RipsComplexResult } from '../../../src-v2/analysis/rips-complex.ts'
import type { RipsPersistenceResult } from '../../../src-v2/analysis/rips-persistence.ts'
import { isAnalysisWorkerResponse } from './analysis-worker-protocol.ts'
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from './analysis-worker-protocol.ts'

interface WorkerLike {
	postMessage(message: unknown): void
	terminate(): void
	addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
	addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
	removeEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void
	removeEventListener(type: 'error', listener: (event: ErrorEvent) => void): void
}

export interface AnalysisWorkerClientOptions {
	readonly createWorker?: () => WorkerLike
}

const abortedError = () => new DOMException('Analysis superseded.', 'AbortError')

export class AnalysisWorkerClient {
	private worker: WorkerLike | undefined
	private requestCounter = 0
	private disposed = false
	private readonly pending = new Map<string, {
		readonly resolve: (value: AnalysisWorkerResponse) => void
		readonly reject: (error: unknown) => void
		readonly signal: AbortSignal
		readonly abort: () => void
	}>()

	constructor(private readonly options: AnalysisWorkerClientOptions = {}) {}

	private createWorker(): WorkerLike {
		return this.options.createWorker?.()
			?? new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
	}

	private ensureWorker(): WorkerLike {
		if (this.disposed) throw new Error('Cannot use a disposed analysis worker client.')
		if (this.worker) return this.worker
		const worker = this.createWorker()
		worker.addEventListener('message', this.onMessage)
		worker.addEventListener('error', this.onError)
		this.worker = worker
		return worker
	}

	private readonly onMessage = (event: MessageEvent<unknown>) => {
		if (!isAnalysisWorkerResponse(event.data)) return
		const pending = this.pending.get(event.data.requestId)
		if (!pending) return
		this.pending.delete(event.data.requestId)
		pending.signal.removeEventListener('abort', pending.abort)
		if (event.data.type === 'analysis-error') pending.reject(new Error(event.data.message))
		else pending.resolve(event.data)
	}

	private readonly onError = (event: ErrorEvent) => {
		this.failWorker(new Error(event.message || 'Analysis worker failed.'))
	}

	private failWorker(error: unknown): void {
		const worker = this.worker
		this.worker = undefined
		if (worker) {
			worker.removeEventListener('message', this.onMessage)
			worker.removeEventListener('error', this.onError)
			worker.terminate()
		}
		for (const pending of this.pending.values()) {
			pending.signal.removeEventListener('abort', pending.abort)
			pending.reject(error)
		}
		this.pending.clear()
	}

	private request(
		request: AnalysisWorkerRequest,
		signal: AbortSignal,
	): Promise<AnalysisWorkerResponse> {
		if (signal.aborted) return Promise.reject(abortedError())
		return new Promise((resolve, reject) => {
			const abort = () => this.failWorker(abortedError())
			this.pending.set(request.requestId, { resolve, reject, signal, abort })
			signal.addEventListener('abort', abort, { once: true })
			try {
				this.ensureWorker().postMessage(request)
			} catch (error) {
				this.pending.delete(request.requestId)
				signal.removeEventListener('abort', abort)
				reject(error)
			}
		})
	}

	async analyzeRips(snapshot: PointCloudSnapshot, epsilon: number, signal: AbortSignal): Promise<RipsComplexResult> {
		const response = await this.request({
			type: 'analyze-rips', requestId: `structure-${this.requestCounter++}`, snapshot, epsilon,
		}, signal)
		if (response.type !== 'rips-result') throw new Error(`Unexpected analysis worker response '${response.type}'.`)
		return response.result
	}

	async analyzePersistence(snapshot: PointCloudSnapshot, epsilonMax: number, signal: AbortSignal): Promise<RipsPersistenceResult> {
		const response = await this.request({
			type: 'analyze-rips-persistence', requestId: `persistence-${this.requestCounter++}`, snapshot, epsilonMax,
		}, signal)
		if (response.type !== 'persistence-result') throw new Error(`Unexpected analysis worker response '${response.type}'.`)
		return response.result
	}

	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		this.failWorker(new Error('Analysis worker client disposed.'))
	}
}
