export interface AnalysisExecution<Value> {
	readonly value: Value
	readonly sampleCount: number
	readonly inputCount: number
	readonly warnings?: readonly string[]
}

export interface ScheduledAnalysisResult<Parameters, Value> {
	readonly snapshotId: string
	readonly analysisRequestId: string
	readonly analyzerId: string
	readonly analyzerVersion: string
	readonly parameters: Parameters
	readonly durationMs: number
	readonly sampleCount: number
	readonly inputCount: number
	readonly warnings: readonly string[]
	readonly value: Value
}

export type AnalysisScheduleOutcome<Parameters, Value> =
	| { readonly status: 'completed'; readonly result: ScheduledAnalysisResult<Parameters, Value> }
	| { readonly status: 'superseded'; readonly analysisRequestId: string }

export interface ScheduleAnalysisOptions<Parameters, Value> {
	readonly snapshotId: string
	readonly analyzerId: string
	readonly analyzerVersion: string
	readonly parameters: Parameters
	readonly execute: (signal: AbortSignal) => Promise<AnalysisExecution<Value>>
}

export class AnalysisScheduler {
	private requestCounter = 0
	private active: { readonly requestId: string; readonly controller: AbortController } | undefined
	private disposed = false

	async schedule<Parameters, Value>({
		snapshotId,
		analyzerId,
		analyzerVersion,
		parameters,
		execute,
	}: ScheduleAnalysisOptions<Parameters, Value>): Promise<AnalysisScheduleOutcome<Parameters, Value>> {
		if (this.disposed) throw new Error('Cannot schedule analysis after disposal.')
		this.active?.controller.abort(new Error('Analysis superseded by a newer request.'))
		const analysisRequestId = `analysis-${this.requestCounter++}`
		const controller = new AbortController()
		this.active = { requestId: analysisRequestId, controller }
		const startedAt = performance.now()
		try {
			const execution = await execute(controller.signal)
			if (controller.signal.aborted || this.active?.requestId !== analysisRequestId) {
				return { status: 'superseded', analysisRequestId }
			}
			const result: ScheduledAnalysisResult<Parameters, Value> = {
				snapshotId,
				analysisRequestId,
				analyzerId,
				analyzerVersion,
				parameters,
				durationMs: performance.now() - startedAt,
				sampleCount: execution.sampleCount,
				inputCount: execution.inputCount,
				warnings: execution.warnings ?? [],
				value: execution.value,
			}
			return { status: 'completed', result }
		} catch (error) {
			if (controller.signal.aborted || this.active?.requestId !== analysisRequestId) {
				return { status: 'superseded', analysisRequestId }
			}
			throw error
		} finally {
			if (this.active?.requestId === analysisRequestId) this.active = undefined
		}
	}

	cancel(): void {
		this.active?.controller.abort(new Error('Analysis cancelled.'))
		this.active = undefined
	}

	dispose(): void {
		if (this.disposed) return
		this.disposed = true
		this.cancel()
	}
}
