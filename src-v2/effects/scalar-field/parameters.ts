import { defineParameterSchema } from '../../core/index.ts'
import {
	createFormulaParameterSchema,
	defineFormulaParameterDeclarations,
} from '../../formula/index.ts'

export const SCALAR_FIELD_SYSTEM_VARIABLES = Object.freeze(['x', 'y'] as const)

export const SCALAR_FIELD_FORMULA_PARAMETERS = defineFormulaParameterDeclarations([
	{ id: 'k', default: 1, min: -4, max: 4, step: 0.1 },
] as const, SCALAR_FIELD_SYSTEM_VARIABLES)

export const scalarFieldParameters = defineParameterSchema({
	formula: {
		kind: 'string',
		default: 'x^2 + y^2 - k',
		maxLength: 4096,
		control: 'formula',
		invalidation: 'hot-update',
	},
	...createFormulaParameterSchema(SCALAR_FIELD_FORMULA_PARAMETERS),
	domainRadius: {
		kind: 'number', default: 3, min: 1, max: 10, step: 0.5, invalidation: 'hot-update',
	},
	sampleDensity: {
		kind: 'number', default: 48, min: 16, max: 96, step: 8, invalidation: 'hot-update',
	},
	contourLevel: {
		kind: 'number', default: 0, min: -10, max: 10, step: 0.1, invalidation: 'hot-update',
	},
	valueScale: {
		kind: 'number', default: 8, min: 0.5, max: 32, step: 0.5, invalidation: 'hot-update',
	},
	background: {
		kind: 'string', default: '#050508', maxLength: 32, invalidation: 'hot-update',
	},
})
