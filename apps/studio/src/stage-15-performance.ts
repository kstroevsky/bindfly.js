import type { ExperimentTelemetry } from './experiment-session.ts'

const milliseconds = (value: number | string) => `${Number(value).toFixed(2)} ms`

export const STAGE_15_PERFORMANCE_METRICS = [
	{ id: 'simulationMs', label: 'Simulation', format: milliseconds },
	{ id: 'derivationMs', label: 'Derivation', format: milliseconds },
	{ id: 'uploadMs', label: 'Upload', format: milliseconds },
	{ id: 'renderMs', label: 'Render', format: milliseconds },
	{ id: 'totalFrameMs', label: 'Total frame', format: milliseconds },
] as const satisfies readonly {
	readonly id: keyof ExperimentTelemetry
	readonly label: string
	readonly format: (value: number | string) => string
}[]
