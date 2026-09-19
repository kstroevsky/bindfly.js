export const FORMULA_PROGRAM_FORMAT = 'bindfly-formula'
export const FORMULA_PROGRAM_VERSION = 1
export const FORMULA_TRANSFORM_FORMAT = 'bindfly-formula-transform'
export const FORMULA_TRANSFORM_VERSION = 1
export const FORMULA_EXPERIMENT_FORMAT = 'bindfly-formula-experiment'
export const FORMULA_EXPERIMENT_VERSION = 1

export interface FormulaLimits {
	readonly maxSourceLength: number
	readonly maxTokens: number
	readonly maxNodes: number
	readonly maxDepth: number
	readonly maxOperations: number
}

export const DEFAULT_FORMULA_LIMITS: FormulaLimits = Object.freeze({
	maxSourceLength: 4_096,
	maxTokens: 1_024,
	maxNodes: 512,
	maxDepth: 64,
	maxOperations: 4_096,
})

export type FormulaLimitOverrides = Partial<FormulaLimits>

export type FormulaIssueCode =
	| 'source-limit'
	| 'token-limit'
	| 'node-limit'
	| 'depth-limit'
	| 'operation-limit'
	| 'invalid-limit'
	| 'invalid-character'
	| 'invalid-number'
	| 'syntax'
	| 'invalid-identifier'
	| 'duplicate-variable'
	| 'unknown-variable'
	| 'unknown-function'
	| 'invalid-arity'
	| 'missing-variable'
	| 'non-finite-input'
	| 'numeric-domain'
	| 'invalid-program'
	| 'invalid-serialization'
	| 'unsupported-version'

export interface FormulaIssue {
	readonly code: FormulaIssueCode
	readonly message: string
	readonly index?: number
}

export type FormulaUnaryOperator = '+' | '-'
export type FormulaBinaryOperator = '+' | '-' | '*' | '/' | '^'
export type FormulaFunctionName = 'sin' | 'cos' | 'tan' | 'atan' | 'exp' | 'log' | 'abs' | 'sqrt' | 'min' | 'max'

interface FormulaNodeBase {
	readonly at: number
}

export type FormulaAst =
	| (FormulaNodeBase & { readonly kind: 'number'; readonly value: number })
	| (FormulaNodeBase & { readonly kind: 'variable'; readonly name: string })
	| (FormulaNodeBase & { readonly kind: 'unary'; readonly operator: FormulaUnaryOperator; readonly argument: FormulaAst })
	| (FormulaNodeBase & { readonly kind: 'binary'; readonly operator: FormulaBinaryOperator; readonly left: FormulaAst; readonly right: FormulaAst })
	| (FormulaNodeBase & { readonly kind: 'call'; readonly name: string; readonly arguments: readonly FormulaAst[] })

export type FormulaInstruction =
	| { readonly op: 'constant'; readonly value: number }
	| { readonly op: 'variable'; readonly index: number }
	| { readonly op: 'unary'; readonly operator: FormulaUnaryOperator }
	| { readonly op: 'binary'; readonly operator: FormulaBinaryOperator }
	| { readonly op: 'call'; readonly function: FormulaFunctionName }

export interface FormulaProgram {
	readonly version: typeof FORMULA_PROGRAM_VERSION
	readonly source: string
	readonly variables: readonly string[]
	readonly operationLimit: number
	readonly instructions: readonly FormulaInstruction[]
}

export interface FormulaCompileOptions {
	readonly variables: readonly string[]
	readonly limits?: FormulaLimitOverrides
}

export interface FormulaTransform2D {
	readonly version: typeof FORMULA_TRANSFORM_VERSION
	readonly x: FormulaProgram
	readonly y: FormulaProgram
}

export interface CompileFormulaTransform2DInput extends FormulaCompileOptions {
	readonly xSource: string
	readonly ySource: string
}

export interface FormulaExperiment {
	readonly version: typeof FORMULA_EXPERIMENT_VERSION
	readonly id: string
	readonly transform: FormulaTransform2D
	readonly configuration: Readonly<Record<string, number>>
}

export interface CompileFormulaExperimentInput extends CompileFormulaTransform2DInput {
	readonly id: string
	readonly configuration?: Readonly<Record<string, number>>
}
