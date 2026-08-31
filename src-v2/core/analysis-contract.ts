export interface AnalysisSnapshot<State> {
	readonly snapshotId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly simulationStepIndex: number
	readonly simulationTimeSeconds: number
	readonly state: Readonly<State>
}

export interface AnalysisContext {
	readonly requestedAtMs: number
	readonly budgetMs?: number
	readonly maxItems?: number
}

export interface AnalysisProvenance {
	readonly snapshotId: string
	readonly experimentId: string
	readonly stateVersion: number
	readonly simulationStepIndex: number
	readonly backendId: string
	readonly backendVersion: string
	readonly durationMs: number
	readonly sampledItemCount: number
	readonly inputItemCount: number
	readonly warnings: readonly string[]
}

export interface AnalysisResult<Result> {
	readonly value: Result
	readonly provenance: AnalysisProvenance
}

export interface AnalyzerDefinition<State, Result> {
	readonly id: string
	analyze(
		snapshot: Readonly<AnalysisSnapshot<State>>,
		context: AnalysisContext,
		signal: AbortSignal,
	): Promise<AnalysisResult<Result>> | AnalysisResult<Result>
}
