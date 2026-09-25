import type { Result } from '../core/index.ts'
import type {
	FormulaAst,
	FormulaCompileOptions,
	FormulaFunctionName,
	FormulaInstruction,
	FormulaIssue,
	FormulaLimitOverrides,
	FormulaLimits,
	FormulaProgram,
	FormulaTraceSite,
} from './contracts.ts'
import { FORMULA_PROGRAM_VERSION } from './contracts.ts'
import { identifierPattern, issue, resolveFormulaLimits } from './internal.ts'
import { parseFormulaAst } from './parser.ts'
import { tokenizeFormula } from './tokenizer.ts'

const functionArities: Readonly<Record<FormulaFunctionName, number>> = Object.freeze({
	sin: 1,
	cos: 1,
	tan: 1,
	atan: 1,
	exp: 1,
	log: 1,
	abs: 1,
	sqrt: 1,
	min: 2,
	max: 2,
})

const isFunctionName = (name: string): name is FormulaFunctionName =>
	Object.hasOwn(functionArities, name)

const parseWithLimits = (source: string, limits: FormulaLimits): Result<FormulaAst, FormulaIssue> => {
	if (source.length > limits.maxSourceLength) {
		return { ok: false, error: issue('source-limit', `Formula exceeds the ${limits.maxSourceLength}-character source limit.`) }
	}
	const tokens = tokenizeFormula(source, limits.maxTokens)
	if (!tokens.ok) return tokens
	return parseFormulaAst(tokens.value, limits.maxDepth)
}

export const parseFormula = (
	source: string,
	limitOverrides: FormulaLimitOverrides = {},
): Result<FormulaAst, FormulaIssue> => {
	const limits = resolveFormulaLimits(limitOverrides)
	return limits.ok ? parseWithLimits(source, limits.value) : limits
}

export const compileFormula = (
	source: string,
	options: FormulaCompileOptions,
): Result<FormulaProgram, FormulaIssue> => {
	const limits = resolveFormulaLimits(options.limits)
	if (!limits.ok) return limits
	const variables = [...options.variables]
	for (const name of variables) {
		if (!identifierPattern.test(name)) {
			return { ok: false, error: issue('invalid-identifier', `Invalid variable identifier '${name}'.`) }
		}
	}
	if (new Set(variables).size !== variables.length) {
		return { ok: false, error: issue('duplicate-variable', 'Formula variable identifiers must be unique.') }
	}
	variables.sort()
	const variableIndices = new Map(variables.map((name, index) => [name, index]))
	const parsed = parseWithLimits(source, limits.value)
	if (!parsed.ok) return parsed

	let nodeCount = 0
	let nodeId = 0
	const instructions: FormulaInstruction[] = []
	const traceSites: FormulaTraceSite[] = []
	const emit = (node: FormulaAst, depth: number): FormulaIssue | undefined => {
		nodeCount++
		const currentNodeId = nodeId++
		if (nodeCount > limits.value.maxNodes) {
			return issue('node-limit', `Formula exceeds the ${limits.value.maxNodes}-node AST limit.`, node.at)
		}
		if (depth > limits.value.maxDepth) {
			return issue('depth-limit', `Formula exceeds the ${limits.value.maxDepth}-level depth limit.`, node.at)
		}
		switch (node.kind) {
			case 'number':
				instructions.push({ op: 'constant', value: node.value })
				traceSites.push({ instructionIndex: instructions.length - 1, nodeId: currentNodeId, start: node.start, end: node.end })
				return undefined
			case 'variable': {
				const index = variableIndices.get(node.name)
				if (index === undefined) return issue('unknown-variable', `Unknown variable '${node.name}'.`, node.at)
				instructions.push({ op: 'variable', index })
				traceSites.push({ instructionIndex: instructions.length - 1, nodeId: currentNodeId, start: node.start, end: node.end })
				return undefined
			}
			case 'unary': {
				const error = emit(node.argument, depth + 1)
				if (error) return error
				instructions.push({ op: 'unary', operator: node.operator })
				traceSites.push({ instructionIndex: instructions.length - 1, nodeId: currentNodeId, start: node.start, end: node.end })
				return undefined
			}
			case 'binary': {
				const leftError = emit(node.left, depth + 1)
				if (leftError) return leftError
				const rightError = emit(node.right, depth + 1)
				if (rightError) return rightError
				instructions.push({ op: 'binary', operator: node.operator })
				traceSites.push({ instructionIndex: instructions.length - 1, nodeId: currentNodeId, start: node.start, end: node.end })
				return undefined
			}
			case 'call': {
				if (!isFunctionName(node.name)) return issue('unknown-function', `Unknown function '${node.name}'.`, node.at)
				const expected = functionArities[node.name]
				if (node.arguments.length !== expected) {
					return issue('invalid-arity', `Function '${node.name}' expects ${expected} argument${expected === 1 ? '' : 's'}, received ${node.arguments.length}.`, node.at)
				}
				for (const argument of node.arguments) {
					const error = emit(argument, depth + 1)
					if (error) return error
				}
				instructions.push({ op: 'call', function: node.name })
				traceSites.push({ instructionIndex: instructions.length - 1, nodeId: currentNodeId, start: node.start, end: node.end })
				return undefined
			}
		}
	}

	const semanticIssue = emit(parsed.value, 1)
	if (semanticIssue) return { ok: false, error: semanticIssue }
	const frozenInstructions = instructions.map((instruction) => Object.freeze(instruction))
	const frozenTraceSites = traceSites
		.sort((left, right) => left.instructionIndex - right.instructionIndex)
		.map((site) => Object.freeze(site))
	return {
		ok: true,
		value: Object.freeze({
			version: FORMULA_PROGRAM_VERSION,
			source,
			variables: Object.freeze(variables),
			operationLimit: limits.value.maxOperations,
			instructions: Object.freeze(frozenInstructions),
			traceSites: Object.freeze(frozenTraceSites),
		}),
	}
}
