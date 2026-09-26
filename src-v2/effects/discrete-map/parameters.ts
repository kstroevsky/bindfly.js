import { defineParameterSchema } from '../../core/index.ts'
import {
	createFormulaParameterSchema,
	defineFormulaParameterDeclarations,
} from '../../formula/index.ts'

export const DISCRETE_MAP_SYSTEM_VARIABLES = Object.freeze(['x', 'y', 'n'] as const)

export const DISCRETE_MAP_FORMULA_PARAMETERS = defineFormulaParameterDeclarations([
	{ id: 'a', default: 1.4, min: 0, max: 4, step: 0.01 },
	{ id: 'b', default: 0.3, min: -2, max: 2, step: 0.01 },
] as const, DISCRETE_MAP_SYSTEM_VARIABLES)

export const discreteMapParameters = defineParameterSchema({
	nextXFormula: {
		kind: 'string',
		default: '1 - a*x^2 + y',
		maxLength: 4096,
		control: 'formula',
		invalidation: 'hot-update',
	},
	nextYFormula: {
		kind: 'string',
		default: 'b*x',
		maxLength: 4096,
		control: 'formula',
		invalidation: 'hot-update',
	},
	...createFormulaParameterSchema(DISCRETE_MAP_FORMULA_PARAMETERS),
	domainRadius: {
		kind: 'number', default: 2, min: 0.5, max: 10, step: 0.5, invalidation: 'reset-simulation',
	},
	trailLength: {
		kind: 'number', default: 768, min: 64, max: 2048, step: 64, invalidation: 'reset-simulation',
	},
	background: {
		kind: 'string', default: '#050508', maxLength: 32, invalidation: 'hot-update',
	},
})
