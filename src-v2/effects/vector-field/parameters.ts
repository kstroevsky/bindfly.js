import { defineParameterSchema } from '../../core/index.ts'
import {
	createFormulaParameterSchema,
	defineFormulaParameterDeclarations,
} from '../../formula/index.ts'

export const VECTOR_FIELD_SYSTEM_VARIABLES = Object.freeze(['x', 'y', 't'] as const)

export const VECTOR_FIELD_FORMULA_PARAMETERS = defineFormulaParameterDeclarations([
	{ id: 'mu', default: 0.8, min: -2, max: 2, step: 0.05 },
] as const, VECTOR_FIELD_SYSTEM_VARIABLES)

export const vectorFieldParameters = defineParameterSchema({
	dxFormula: {
		kind: 'string',
		default: 'mu*x - y - x*(x^2 + y^2)',
		maxLength: 4096,
		control: 'formula',
		invalidation: 'hot-update',
	},
		dyFormula: {
		kind: 'string',
		default: 'x + mu*y - y*(x^2 + y^2)',
		maxLength: 4096,
		control: 'formula',
		invalidation: 'hot-update',
	},
	...createFormulaParameterSchema(VECTOR_FIELD_FORMULA_PARAMETERS),
	domainRadius: {
		kind: 'number', default: 3, min: 1, max: 10, step: 0.5, invalidation: 'reset-simulation',
	},
	fieldDensity: {
		kind: 'number', default: 15, min: 7, max: 31, step: 2, invalidation: 'hot-update',
	},
	trailLength: {
		kind: 'number', default: 384, min: 64, max: 1024, step: 32, invalidation: 'reset-simulation',
	},
	background: {
		kind: 'string', default: '#050508', maxLength: 32, invalidation: 'hot-update',
	},
})
