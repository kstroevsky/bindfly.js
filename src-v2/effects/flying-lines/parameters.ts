import { defineParameterSchema } from '../../core/index.ts'

export const flyingLinesParameters = defineParameterSchema({
	particleCount: {
		kind: 'number',
		default: 100,
		min: 1,
		max: 500,
		step: 1,
		invalidation: 'reset-simulation',
	},
	maxSpeed: {
		kind: 'number',
		default: 60,
		min: 0,
		max: 240,
		step: 1,
		units: 'CSS px/s',
		invalidation: 'reset-simulation',
	},
	connectionRadius: {
		kind: 'number',
		default: 250,
		min: 1,
		max: 500,
		step: 1,
		units: 'CSS px',
		invalidation: 'hot-update',
	},
	particleLifetimeSeconds: {
		kind: 'number',
		default: 20,
		min: 1,
		max: 120,
		step: 1,
		units: 's',
		invalidation: 'reset-simulation',
	},
	margin: {
		kind: 'number',
		default: 20,
		min: 0,
		max: 100,
		step: 1,
		units: 'CSS px',
		invalidation: 'reset-simulation',
	},
	background: {
		kind: 'string',
		default: '#050508',
		maxLength: 32,
		invalidation: 'hot-update',
	},
})
