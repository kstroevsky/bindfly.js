import { defineParameterSchema } from '../../core/index.ts'
import { bindflyOriginals } from '../../formula/index.ts'
import { movingPointParameterDefinitions } from '../moving-points/parameters.ts'

const tangent = bindflyOriginals['drooping-tan-x']
const arctangent = bindflyOriginals['drooping-atan-y']

export const droopingLinesParameters = defineParameterSchema({
	...movingPointParameterDefinitions,
	connectionRadius: {
		kind: 'number', default: 250, min: 1, max: 500, step: 1, units: 'CSS px', invalidation: 'hot-update',
	},
	background: {
		kind: 'string', default: '#050508', maxLength: 32, invalidation: 'hot-update',
	},
	formulaAX: {
		kind: 'string', default: tangent.xSource, maxLength: 4096, invalidation: 'hot-update',
	},
	formulaAY: {
		kind: 'string', default: tangent.ySource, maxLength: 4096, invalidation: 'hot-update',
	},
	formulaBX: {
		kind: 'string', default: arctangent.xSource, maxLength: 4096, invalidation: 'hot-update',
	},
	formulaBY: {
		kind: 'string', default: arctangent.ySource, maxLength: 4096, invalidation: 'hot-update',
	},
	formulaMorph: {
		kind: 'number', default: 0, min: 0, max: 1, step: 0.01, invalidation: 'hot-update',
	},
})
