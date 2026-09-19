import type { Result } from '../core/index.ts'
import type { FormulaFunctionName, FormulaInstruction, FormulaIssue, FormulaProgram } from './contracts.ts'
import { DEFAULT_FORMULA_LIMITS, FORMULA_PROGRAM_VERSION } from './contracts.ts'
import { issue } from './internal.ts'

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value)

const functionNames: readonly FormulaFunctionName[] = [
	'sin', 'cos', 'tan', 'atan', 'exp', 'log', 'abs', 'sqrt', 'min', 'max',
]

const isFormulaInstruction = (value: unknown): value is FormulaInstruction => {
	if (!isRecord(value) || typeof value.op !== 'string') return false
	if (value.op === 'constant') return typeof value.value === 'number'
	if (value.op === 'variable') return Number.isInteger(value.index) && (value.index as number) >= 0
	if (value.op === 'unary') return value.operator === '+' || value.operator === '-'
	if (value.op === 'binary') return ['+', '-', '*', '/', '^'].includes(String(value.operator))
	return value.op === 'call' && typeof value.function === 'string'
		&& functionNames.includes(value.function as FormulaFunctionName)
}

const finiteResult = (value: number, operation: string): Result<number, FormulaIssue> =>
	Number.isFinite(value)
		? { ok: true, value }
		: { ok: false, error: issue('numeric-domain', `Formula operation '${operation}' produced a non-finite result.`) }

const evaluateFunction = (name: FormulaFunctionName, args: readonly number[]): Result<number, FormulaIssue> => {
	const first = args[0] ?? 0
	if (name === 'log' && first <= 0) return { ok: false, error: issue('numeric-domain', "Function 'log' requires a positive argument.") }
	if (name === 'sqrt' && first < 0) return { ok: false, error: issue('numeric-domain', "Function 'sqrt' requires a non-negative argument.") }
	let value: number
	switch (name) {
		case 'sin': value = Math.sin(first); break
		case 'cos': value = Math.cos(first); break
		case 'tan': value = Math.tan(first); break
		case 'atan': value = Math.atan(first); break
		case 'exp': value = Math.exp(first); break
		case 'log': value = Math.log(first); break
		case 'abs': value = Math.abs(first); break
		case 'sqrt': value = Math.sqrt(first); break
		case 'min': value = Math.min(first, args[1] ?? 0); break
		case 'max': value = Math.max(first, args[1] ?? 0); break
		default: return { ok: false, error: issue('invalid-program', `Formula function '${String(name)}' is invalid.`) }
	}
	return finiteResult(value, String(name))
}

export const evaluateFormula = (
	program: FormulaProgram,
	scope: Readonly<Record<string, number>>,
): Result<number, FormulaIssue> => {
	const candidate: unknown = program
	if (!isRecord(candidate)
		|| !Array.isArray(candidate.variables)
		|| !candidate.variables.every((name): name is string => typeof name === 'string')
		|| !Array.isArray(candidate.instructions)
		|| !candidate.instructions.every(isFormulaInstruction)) {
		return { ok: false, error: issue('invalid-program', 'Formula program shape is invalid.') }
	}
	const variableNames = candidate.variables
	const instructions = candidate.instructions
	if (candidate.version !== FORMULA_PROGRAM_VERSION) {
		return { ok: false, error: issue('invalid-program', `Formula program version '${String(candidate.version)}' is invalid.`) }
	}
	if (typeof scope !== 'object' || scope === null) {
		return { ok: false, error: issue('invalid-program', 'Formula scope must be an object.') }
	}
	if (new Set(variableNames).size !== variableNames.length) {
		return { ok: false, error: issue('invalid-program', 'Formula program variables must be unique.') }
	}
	const variables: number[] = []
	for (const name of variableNames) {
		if (!Object.hasOwn(scope, name)) return { ok: false, error: issue('missing-variable', `Missing formula variable '${name}'.`) }
		const value = scope[name]
		if (typeof value !== 'number' || !Number.isFinite(value)) {
			return { ok: false, error: issue('non-finite-input', `Formula variable '${name}' must be finite.`) }
		}
		variables.push(value)
	}
	if (!Number.isInteger(candidate.operationLimit)
		|| (candidate.operationLimit as number) <= 0
		|| (candidate.operationLimit as number) > DEFAULT_FORMULA_LIMITS.maxOperations
		|| instructions.length > DEFAULT_FORMULA_LIMITS.maxOperations) {
		return { ok: false, error: issue('invalid-program', 'Formula operation limit is invalid.') }
	}
	const operationLimit = candidate.operationLimit as number
	const stack: number[] = []
	let operations = 0
	const pop = (): Result<number, FormulaIssue> => {
		const value = stack.pop()
		return value === undefined
			? { ok: false, error: issue('invalid-program', 'Formula instruction stack underflow.') }
			: { ok: true, value }
	}

	for (const instruction of instructions) {
		operations++
		if (operations > operationLimit) {
			return { ok: false, error: issue('operation-limit', `Formula exceeds the ${operationLimit}-operation evaluation limit.`) }
		}
		switch (instruction.op) {
			case 'constant':
				if (!Number.isFinite(instruction.value)) return { ok: false, error: issue('invalid-program', 'Formula constant is not finite.') }
				stack.push(instruction.value)
				break
			case 'variable': {
				const value = variables[instruction.index]
				if (value === undefined) return { ok: false, error: issue('invalid-program', `Formula variable index ${instruction.index} is invalid.`) }
				stack.push(value)
				break
			}
			case 'unary': {
				const argument = pop()
				if (!argument.ok) return argument
				if (instruction.operator === '-') stack.push(-argument.value)
				else if (instruction.operator === '+') stack.push(argument.value)
				else return { ok: false, error: issue('invalid-program', `Formula unary operator '${String(instruction.operator)}' is invalid.`) }
				break
			}
			case 'binary': {
				const right = pop()
				if (!right.ok) return right
				const left = pop()
				if (!left.ok) return left
				let value: number
				switch (instruction.operator) {
					case '+': value = left.value + right.value; break
					case '-': value = left.value - right.value; break
					case '*': value = left.value * right.value; break
					case '/': value = left.value / right.value; break
					case '^': value = Math.pow(left.value, right.value); break
					default: return { ok: false, error: issue('invalid-program', 'Formula binary operator is invalid.') }
				}
				const checked = finiteResult(value, instruction.operator)
				if (!checked.ok) return checked
				stack.push(checked.value)
				break
			}
			case 'call': {
				const arity = instruction.function === 'min' || instruction.function === 'max' ? 2 : 1
				const args = new Array<number>(arity)
				for (let index = arity - 1; index >= 0; index--) {
					const argument = pop()
					if (!argument.ok) return argument
					args[index] = argument.value
				}
				const result = evaluateFunction(instruction.function, args)
				if (!result.ok) return result
				stack.push(result.value)
				break
			}
			default:
				return { ok: false, error: issue('invalid-program', 'Formula instruction is invalid.') }
		}
	}
	return stack.length === 1
		? { ok: true, value: stack[0] ?? 0 }
		: { ok: false, error: issue('invalid-program', `Formula finished with ${stack.length} stack values.`) }
}
