import { defineParameterSchema } from '../../core/index.ts'
import type { BindflyOriginalFormula } from '../../formula/index.ts'

export const MAXIMUM_PARAMETRIC_POINT_COUNT = 500

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
	formulaView: {
		kind: 'enum', default: 'morph', values: ['morph', 'compare'], invalidation: 'hot-update',
	},
})
