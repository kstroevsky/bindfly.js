import type { ParameterSchema } from '../../core/index.ts'

export const MAXIMUM_MOVING_POINT_COUNT = 500

export const movingPointParameterDefinitions = {
	particleCount: {
		kind: 'number', default: 100, min: 1, max: MAXIMUM_MOVING_POINT_COUNT, step: 1, invalidation: 'reset-simulation',
	},
	maxSpeed: {
		kind: 'number', default: 60, min: 0, max: 240, step: 1, units: 'CSS px/s', invalidation: 'reset-simulation',
	},
	particleLifetimeSeconds: {
		kind: 'number', default: 20, min: 1, max: 120, step: 1, units: 's', invalidation: 'reset-simulation',
	},
	margin: {
		kind: 'number', default: 20, min: 0, max: 100, step: 1, units: 'CSS px', invalidation: 'reset-simulation',
	},
} as const satisfies ParameterSchema
