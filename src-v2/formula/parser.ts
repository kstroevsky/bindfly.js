import type { Result } from '../core/index.ts'
import type { FormulaAst, FormulaBinaryOperator, FormulaIssue, FormulaUnaryOperator } from './contracts.ts'
import { issue } from './internal.ts'
import type { FormulaToken } from './tokenizer.ts'

class FormulaParseFailure extends Error {
	readonly formulaIssue: FormulaIssue

	constructor(formulaIssue: FormulaIssue) {
		super(formulaIssue.message)
		this.formulaIssue = formulaIssue
	}
}

class Parser {
	private readonly tokens: readonly FormulaToken[]
	private readonly maxDepth: number
	private position = 0
	private recursionDepth = 0

	constructor(tokens: readonly FormulaToken[], maxDepth: number) {
		this.tokens = tokens
		this.maxDepth = maxDepth
	}

	parse(): FormulaAst {
		const expression = this.parseAdditive()
		const next = this.peek()
		if (next.kind !== 'end') this.fail(`Unexpected token at index ${next.at}.`, next.at)
		return expression
	}

	private peek(): FormulaToken {
		const end = this.tokens.at(-1)?.at ?? 0
		return this.tokens[this.position] ?? { kind: 'end', at: end, end }
	}

	private consume(): FormulaToken {
		const token = this.peek()
		this.position++
		return token
	}

	private fail(message: string, at: number): never {
		throw new FormulaParseFailure(issue('syntax', message, at))
	}

	private nested<T>(at: number, parse: () => T): T {
		this.recursionDepth++
		if (this.recursionDepth > this.maxDepth) {
			throw new FormulaParseFailure(issue('depth-limit', `Formula exceeds the ${this.maxDepth}-level depth limit.`, at))
		}
		try { return parse() } finally { this.recursionDepth-- }
	}

	private takeOperator(operators: readonly string[]): FormulaToken | undefined {
		const token = this.peek()
		if (token.kind !== 'operator' || !operators.includes(token.value)) return undefined
		return this.consume()
	}

	private parseAdditive(): FormulaAst {
		let left = this.parseMultiplicative()
		let operator = this.takeOperator(['+', '-'])
		while (operator?.kind === 'operator') {
			const right = this.parseMultiplicative()
			left = { kind: 'binary', operator: operator.value as FormulaBinaryOperator, left, right, at: operator.at, start: left.start, end: right.end }
			operator = this.takeOperator(['+', '-'])
		}
		return left
	}

	private parseMultiplicative(): FormulaAst {
		let left = this.parseUnary()
		let operator = this.takeOperator(['*', '/'])
		while (operator?.kind === 'operator') {
			const right = this.parseUnary()
			left = { kind: 'binary', operator: operator.value as FormulaBinaryOperator, left, right, at: operator.at, start: left.start, end: right.end }
			operator = this.takeOperator(['*', '/'])
		}
		return left
	}

	private parseUnary(): FormulaAst {
		const operator = this.takeOperator(['+', '-'])
		if (operator?.kind !== 'operator') return this.parsePower()
		return {
			kind: 'unary',
			operator: operator.value as FormulaUnaryOperator,
			argument: this.nested(operator.at, () => this.parseUnary()),
			at: operator.at,
			start: operator.at,
			get end() { return this.argument.end },
		}
	}

	private parsePower(): FormulaAst {
		const left = this.parsePrimary()
		const operator = this.takeOperator(['^'])
		if (operator?.kind !== 'operator') return left
		return {
			kind: 'binary',
			operator: '^',
			left,
			right: this.nested(operator.at, () => this.parseUnary()),
			at: operator.at,
			start: left.start,
			get end() { return this.right.end },
		}
	}

	private parsePrimary(): FormulaAst {
		const token = this.consume()
		if (token.kind === 'number') return { kind: 'number', value: token.value, at: token.at, start: token.at, end: token.end }
		if (token.kind === 'identifier') {
			if (this.peek().kind !== 'left-parenthesis') return { kind: 'variable', name: token.value, at: token.at, start: token.at, end: token.end }
			this.consume()
			const args: FormulaAst[] = []
			if (this.peek().kind !== 'right-parenthesis') {
				let hasMoreArguments = true
				while (hasMoreArguments) {
					args.push(this.nested(token.at, () => this.parseAdditive()))
					hasMoreArguments = this.peek().kind === 'comma'
					if (hasMoreArguments) this.consume()
				}
			}
			const closing = this.consume()
			if (closing.kind !== 'right-parenthesis') this.fail(`Expected ')' for function '${token.value}'.`, closing.at)
			return { kind: 'call', name: token.value, arguments: args, at: token.at, start: token.at, end: closing.end }
		}
		if (token.kind === 'left-parenthesis') {
			const expression = this.nested(token.at, () => this.parseAdditive())
			const closing = this.consume()
			if (closing.kind !== 'right-parenthesis') this.fail("Expected ')'.", closing.at)
			return expression
		}
		this.fail('Expected a number, variable, function call, or parenthesized expression.', token.at)
	}
}

const freezeAst = (node: FormulaAst): FormulaAst => {
	switch (node.kind) {
		case 'number':
		case 'variable':
			return Object.freeze(node)
		case 'unary':
			return Object.freeze({ ...node, argument: freezeAst(node.argument) })
		case 'binary':
			return Object.freeze({ ...node, left: freezeAst(node.left), right: freezeAst(node.right) })
		case 'call':
			return Object.freeze({ ...node, arguments: Object.freeze(node.arguments.map(freezeAst)) })
	}
}

export const parseFormulaAst = (
	tokens: readonly FormulaToken[],
	maxDepth: number,
): Result<FormulaAst, FormulaIssue> => {
	try {
		return { ok: true, value: freezeAst(new Parser(tokens, maxDepth).parse()) }
	} catch (error) {
		return error instanceof FormulaParseFailure
			? { ok: false, error: error.formulaIssue }
			: { ok: false, error: issue('syntax', error instanceof Error ? error.message : 'Formula parsing failed.') }
	}
}
