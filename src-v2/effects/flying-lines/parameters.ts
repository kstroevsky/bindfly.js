import { defineParameterSchema } from '../../core/index.ts'
import { movingPointParameterDefinitions } from '../moving-points/parameters.ts'

export const flyingLinesParameters = defineParameterSchema({
	...movingPointParameterDefinitions,
	connectionRadius: {
		kind: 'number',
		default: 250,
		min: 1,
		max: 500,
		step: 1,
		units: 'CSS px',
		invalidation: 'hot-update',
	},
	background: {
		kind: 'string',
		default: '#050508',
		maxLength: 32,
		invalidation: 'hot-update',
	},
})
