export interface Stage15RenderingWorkload {
	readonly id: string
	readonly experimentId: 'flying-lines' | 'vector-field-2d' | 'discrete-map-2d' | 'scalar-field-2d'
	readonly seed: string
	readonly parameters: Readonly<Record<string, number | string>>
	readonly initialConditions: readonly { readonly xFraction: number; readonly yFraction: number }[]
	readonly minimumSimulationStep: number
	readonly warmupMilliseconds: number
	readonly sampleCount: number
}

export const STAGE_15_RENDERING_BENCHMARK_VERSION = 1

const phaseSpaceInitialConditions = Object.freeze([
	{ xFraction: 0.20, yFraction: 0.20 },
	{ xFraction: 0.35, yFraction: 0.20 },
	{ xFraction: 0.50, yFraction: 0.20 },
	{ xFraction: 0.65, yFraction: 0.20 },
	{ xFraction: 0.80, yFraction: 0.20 },
	{ xFraction: 0.20, yFraction: 0.50 },
	{ xFraction: 0.35, yFraction: 0.50 },
	{ xFraction: 0.65, yFraction: 0.50 },
	{ xFraction: 0.80, yFraction: 0.50 },
	{ xFraction: 0.20, yFraction: 0.80 },
	{ xFraction: 0.35, yFraction: 0.80 },
	{ xFraction: 0.50, yFraction: 0.80 },
	{ xFraction: 0.65, yFraction: 0.80 },
	{ xFraction: 0.80, yFraction: 0.80 },
] as const)

export const STAGE_15_RENDERING_WORKLOADS = Object.freeze([
	{
		id: 'flying-lines-dense-500',
		experimentId: 'flying-lines',
		seed: 'bindfly-flying-lines-simple-v1',
		parameters: { particleCount: 500, connectionRadius: 120 },
		initialConditions: [],
		minimumSimulationStep: 240,
		warmupMilliseconds: 500,
		sampleCount: 40,
	},
	{
		id: 'vector-field-glyphs-and-trails',
		experimentId: 'vector-field-2d',
		seed: 'vector-field-hopf-v1',
		parameters: { fieldDensity: 31, trailLength: 1024 },
		initialConditions: phaseSpaceInitialConditions,
		minimumSimulationStep: 240,
		warmupMilliseconds: 500,
		sampleCount: 40,
	},
	{
		id: 'discrete-map-many-orbit-points',
		experimentId: 'discrete-map-2d',
		seed: 'henon-map-v1',
		parameters: { trailLength: 2048 },
		initialConditions: phaseSpaceInitialConditions,
		minimumSimulationStep: 72,
		warmupMilliseconds: 500,
		sampleCount: 40,
	},
	{
		id: 'scalar-field-dense-grid',
		experimentId: 'scalar-field-2d',
		seed: 'scalar-field-radial-v1',
		parameters: { sampleDensity: 96 },
		initialConditions: [],
		minimumSimulationStep: 0,
		warmupMilliseconds: 1000,
		sampleCount: 40,
	},
] as const satisfies readonly Stage15RenderingWorkload[])
