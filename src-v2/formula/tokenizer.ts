import type { Result } from '../core/index.ts'
import type { FormulaIssue } from './contracts.ts'
import { issue } from './internal.ts'

export type FormulaToken =
	| { readonly kind: 'number'; readonly value: number; readonly at: number; readonly end: number }
	| { readonly kind: 'identifier'; readonly value: string; readonly at: number; readonly end: number }
	| { readonly kind: 'operator'; readonly value: '+' | '-' | '*' | '/' | '^'; readonly at: number; readonly end: number }
	| { readonly kind: 'left-parenthesis' | 'right-parenthesis' | 'comma' | 'end'; readonly at: number; readonly end: number }

const numberPattern = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/
const identifierStart = /[A-Za-z_]/
const identifierPart = /[A-Za-z0-9_]/

export const tokenizeFormula = (
	source: string,
	maxTokens: number,
): Result<readonly FormulaToken[], FormulaIssue> => {
	const tokens: FormulaToken[] = []
	let index = 0
	const append = (token: FormulaToken): FormulaIssue | undefined => {
		if (token.kind !== 'end' && tokens.length >= maxTokens) {
			return issue('token-limit', `Formula exceeds the ${maxTokens}-token limit.`, token.at)
		}
		tokens.push(token)
		return undefined
	}

	while (index < source.length) {
		const character = source[index] ?? ''
		if (/\s/.test(character)) { index++; continue }
		if (/\d/.test(character) || (character === '.' && /\d/.test(source[index + 1] ?? ''))) {
			const matched = numberPattern.exec(source.slice(index))?.[0]
			if (!matched) return { ok: false, error: issue('invalid-number', 'Invalid number.', index) }
			const value = Number(matched)
			if (!Number.isFinite(value)) return { ok: false, error: issue('invalid-number', 'Formula numbers must be finite.', index) }
			const error = append({ kind: 'number', value, at: index, end: index + matched.length })
			if (error) return { ok: false, error }
			index += matched.length
			continue
		}
		if (identifierStart.test(character)) {
			const start = index++
			while (identifierPart.test(source[index] ?? '')) index++
			const error = append({ kind: 'identifier', value: source.slice(start, index), at: start, end: index })
			if (error) return { ok: false, error }
			continue
		}
		if (['+', '-', '*', '/', '^'].includes(character)) {
			const start = index++
			const error = append({ kind: 'operator', value: character as '+' | '-' | '*' | '/' | '^', at: start, end: index })
			if (error) return { ok: false, error }
			continue
		}
		const punctuation = character === '(' ? 'left-parenthesis'
			: character === ')' ? 'right-parenthesis'
				: character === ',' ? 'comma'
					: undefined
		if (punctuation) {
			const start = index++
			const error = append({ kind: punctuation, at: start, end: index })
			if (error) return { ok: false, error }
			continue
		}
		return { ok: false, error: issue('invalid-character', `Invalid formula character '${character}'.`, index) }
	}
	tokens.push({ kind: 'end', at: source.length, end: source.length })
	return { ok: true, value: tokens }
}
