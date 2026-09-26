import type { Result } from '../core/index.ts'
import type { FormulaExperiment, FormulaIssue } from './contracts.ts'
import { compileFormulaExperiment } from './experiment.ts'

export const BINDFLY_ORIGINAL_FORMAT = 'bindfly-original-formula'
export const BINDFLY_ORIGINAL_VERSION = 1

export interface BindflyOriginalFormula {
	readonly format: typeof BINDFLY_ORIGINAL_FORMAT
	readonly version: typeof BINDFLY_ORIGINAL_VERSION
	readonly id: string
	readonly title: string
	readonly variables: readonly string[]
	readonly xSource: string
	readonly ySource: string
	readonly provenance: {
		readonly legacyPath: string
		readonly legacyGitBlob: string
		readonly capturedBehavior: string
	}
}

const defineOriginal = (definition: BindflyOriginalFormula): BindflyOriginalFormula => Object.freeze({
	...definition,
	variables: Object.freeze([...definition.variables]),
	provenance: Object.freeze({ ...definition.provenance }),
})

export const bindflyOriginals = Object.freeze({
	'drooping-tan-x': defineOriginal({
		format: BINDFLY_ORIGINAL_FORMAT,
		version: BINDFLY_ORIGINAL_VERSION,
		id: 'drooping-tan-x',
		title: 'Drooping Lines · tangent x',
		variables: ['x', 'y'],
		xSource: 'tan(x)',
		ySource: 'y',
		provenance: {
			legacyPath: 'src/shared/2d/animations/DroopingLines/index.js',
			legacyGitBlob: 'f3298c9a6208b2dea3e734d0ce166bb203d0f1dc',
			capturedBehavior: 'drawLinesWithoutAdding source endpoint transform',
		},
	}),
	'drooping-atan-y': defineOriginal({
		format: BINDFLY_ORIGINAL_FORMAT,
		version: BINDFLY_ORIGINAL_VERSION,
		id: 'drooping-atan-y',
		title: 'Drooping Lines · inverse tangent y',
		variables: ['x', 'y'],
		xSource: 'x',
		ySource: 'atan(y)',
		provenance: {
			legacyPath: 'src/shared/2d/animations/DroopingLines/index.js',
			legacyGitBlob: 'f3298c9a6208b2dea3e734d0ce166bb203d0f1dc',
			capturedBehavior: 'drawLinesWithAdding source endpoint transform',
		},
	}),
	'pulse-2023': defineOriginal({
		format: BINDFLY_ORIGINAL_FORMAT,
		version: BINDFLY_ORIGINAL_VERSION,
		id: 'pulse-2023',
		title: 'Pulse 2023',
		variables: ['a', 'angle', 'distance', 'positionX', 'positionY', 'weight'],
		xSource: 'positionX + distance * cos(a) * -1',
		ySource: 'positionY + tan(distance) * weight * cos(angle * exp(a)) * atan(a)',
		provenance: {
			legacyPath: 'src/shared/2d/animations/Pulse/index.js',
			legacyGitBlob: '192936b1e58ebbbea7bc8d1ca1e20801c3f7a6ac',
			capturedBehavior: 'drawLinesWithoutAdding per-particle coordinates',
		},
	}),
	'spiral-1': defineOriginal({
		format: BINDFLY_ORIGINAL_FORMAT,
		version: BINDFLY_ORIGINAL_VERSION,
		id: 'spiral-1',
		title: 'Spiral I',
		variables: ['a', 'angle', 'distance', 'positionX', 'positionY'],
		xSource: 'positionX + distance * cos(angle * exp(a)) * sin(a)',
		ySource: 'positionY + distance * cos(a) * -1',
		provenance: {
			legacyPath: 'src/shared/2d/animations/Spiral/index.js',
			legacyGitBlob: 'a7db9d519575edfee414ace67804d3532641611f',
			capturedBehavior: 'drawLinesWithoutAdding per-particle coordinates',
		},
	}),
	'spiral-2': defineOriginal({
		format: BINDFLY_ORIGINAL_FORMAT,
		version: BINDFLY_ORIGINAL_VERSION,
		id: 'spiral-2',
		title: 'Spiral II',
		variables: ['a', 'angle', 'distance', 'positionX', 'positionY'],
		xSource: 'positionX + distance * cos(angle * exp(a)) * atan(a)',
		ySource: 'positionY + distance * cos(a) * -1',
		provenance: {
			legacyPath: 'src/shared/2d/animations/Spiral2/index.js',
			legacyGitBlob: 'c75fea1c2d609a130d7339c248cb2715d05997c3',
			capturedBehavior: 'drawLinesWithoutAdding per-particle coordinates',
		},
	}),
	'spiral-3': defineOriginal({
		format: BINDFLY_ORIGINAL_FORMAT,
		version: BINDFLY_ORIGINAL_VERSION,
		id: 'spiral-3',
		title: 'Spiral III',
		variables: ['a', 'angle', 'distance', 'positionX', 'positionY'],
		xSource: 'positionX + distance * cos(angle * exp(a)) * atan(a)',
		ySource: 'positionY + distance * cos(sin(a)) * -1',
		provenance: {
			legacyPath: 'src/shared/2d/animations/Spiral3/index.js',
			legacyGitBlob: '6698b332edca40938b1527cd0916bb43a7c085d2',
			capturedBehavior: 'drawLinesWithoutAdding per-particle coordinates',
		},
	}),
})

export type BindflyOriginalId = keyof typeof bindflyOriginals

export const compileBindflyOriginal = (
	id: BindflyOriginalId,
): Result<FormulaExperiment, FormulaIssue> => {
	const original = bindflyOriginals[id]
	return compileFormulaExperiment({
		id: original.id,
		variables: original.variables,
		xSource: original.xSource,
		ySource: original.ySource,
	})
}
