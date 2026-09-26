import { defineParameterSchema } from '../../core/index.ts'
import {
	createFormulaParameterSchema,
	defineFormulaParameterDeclarations,
} from '../../formula/index.ts'
import type { BindflyOriginalFormula } from '../../formula/index.ts'

export const MAXIMUM_PARAMETRIC_POINT_COUNT = 500

export const PARAMETRIC_ORIGINAL_SYSTEM_VARIABLES = Object.freeze([
	'a', 'angle', 'distance', 'positionX', 'positionY', 'weight',
] as const)

export const PARAMETRIC_ORIGINAL_FORMULA_PARAMETERS = defineFormulaParameterDeclarations([
	{ id: 'k', default: 1, min: -10, max: 10, step: 0.01 },
	{ id: 'b', default: 0, min: -100, max: 100, step: 0.1 },
] as const, PARAMETRIC_ORIGINAL_SYSTEM_VARIABLES)

export const createParametricOriginalParameters = (original: BindflyOriginalFormula) => defineParameterSchema({
	particleCount: {
		kind: 'number', default: 100, min: 1, max: MAXIMUM_PARAMETRIC_POINT_COUNT, step: 1, invalidation: 'reset-simulation',
	},
	connectionRadius: {
		kind: 'number', default: 250, min: 1, max: 1000, step: 1, units: 'CSS px', invalidation: 'hot-update',
	},
	weight: {
		kind: 'number', default: 10, min: 0, max: 100, step: 0.1, invalidation: 'hot-update',
	},
	phaseMode: {
		kind: 'enum',
		default: 'original',
		values: ['original', 'controlled'] as const,
		labels: {
			original: 'Original',
			controlled: 'Controlled phase · mathematical variant',
		},
		invalidation: 'reset-simulation',
	},
	controlledPhase: {
		kind: 'number', default: 2.6, min: -100, max: 100, step: 0.01, invalidation: 'reset-simulation',
	},
	...createFormulaParameterSchema(PARAMETRIC_ORIGINAL_FORMULA_PARAMETERS),
	background: {
		kind: 'string', default: '#050508', maxLength: 32, invalidation: 'hot-update',
	},
	formulaAX: {
		kind: 'string', default: original.xSource, maxLength: 4096, control: 'formula', invalidation: 'hot-update',
	},
	formulaAY: {
		kind: 'string', default: original.ySource, maxLength: 4096, control: 'formula', invalidation: 'hot-update',
	},
	formulaBX: {
		kind: 'string', default: original.xSource, maxLength: 4096, control: 'formula', invalidation: 'hot-update',
	},
	formulaBY: {
		kind: 'string', default: original.ySource, maxLength: 4096, control: 'formula', invalidation: 'hot-update',
	},
	formulaMorph: {
		kind: 'number', default: 0, min: 0, max: 1, step: 0.01, invalidation: 'hot-update',
	},
})
