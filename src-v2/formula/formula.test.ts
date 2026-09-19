import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

import type { Result } from '../core/index.ts'
import type { FormulaIssue, FormulaProgram } from './contracts.ts'
import {
	compileFormula,
	compileFormulaExperiment,
	compileFormulaTransform2D,
	evaluateFormula,
	evaluateFormulaExperiment,
	evaluateFormulaTransform2D,
	parseFormula,
	parseFormulaProgram,
	parseFormulaExperiment,
	parseFormulaTransform2D,
	serializeFormulaProgram,
	serializeFormulaExperiment,
	serializeFormulaTransform2D,
} from './index.ts'

const expectCompiled = (source: string, variables: readonly string[] = []) => {
	const result = compileFormula(source, { variables })
	if (!result.ok) assert.fail(result.error.message)
	return result.value
}

const expectFormulaError = <Value>(result: Result<Value, FormulaIssue>): FormulaIssue => {
	if (result.ok) assert.fail('Expected formula operation to fail.')
	return result.error
}

const expectValue = (source: string, expected: number, scope: Readonly<Record<string, number>> = {}) => {
	const program = expectCompiled(source, Object.keys(scope))
	const result = evaluateFormula(program, scope)
	assert.equal(result.ok, true, result.ok ? undefined : result.error.message)
	if (result.ok) assert.ok(Math.abs(result.value - expected) < 1e-12, `${result.value} !== ${expected}`)
}

test('parses precedence, associativity and the complete allowlisted function set', () => {
	expectValue('-2^2 + 3 * 4', 8)
	expectValue('2^3^2', 512)
	expectValue(
		'sin(0)+cos(0)+tan(0)+atan(1)+exp(0)+log(1)+abs(-2)+sqrt(9)+min(4,2)+max(4,2)',
		13 + Math.PI / 4,
	)
})

test('validates variables, functions, arity and the closed grammar', () => {
	assert.match(expectFormulaError(compileFormula('x + y', { variables: ['x'] })).message, /Unknown variable 'y'/)
	assert.match(expectFormulaError(compileFormula('floor(x)', { variables: ['x'] })).message, /Unknown function 'floor'/)
	assert.match(expectFormulaError(compileFormula('sin(1, 2)', { variables: [] })).message, /expects 1 argument/)
	assert.match(expectFormulaError(compileFormula('min(1)', { variables: [] })).message, /expects 2 arguments/)
	for (const source of ['x.constructor', 'globalThis', 'sin.call(0)', 'x = 1', '() => 1', '[1]', '1;2']) {
		assert.equal(compileFormula(source, { variables: ['x'] }).ok, false, source)
	}
	assert.equal(compileFormula('x', { variables: ['x', 'x'] }).ok, false)
	assert.equal(compileFormula('x', { variables: ['not-valid!'] }).ok, false)
	assert.equal(compileFormula('x', { variables: ['x'], limits: { maxOperations: 4_097 } }).ok, false)
})

test('rejects non-finite variables and invalid numeric domains atomically', () => {
	for (const source of ['1/0', 'sqrt(-1)', 'log(0)', '(-1)^0.5', 'exp(1000)']) {
		const result = evaluateFormula(expectCompiled(source), {})
		assert.equal(result.ok, false, source)
	}
	assert.equal(evaluateFormula(expectCompiled('x', ['x']), { x: Number.NaN }).ok, false)
	assert.equal(evaluateFormula(expectCompiled('x', ['x']), {}).ok, false)
})

test('rejects forged in-memory programs without selecting fallback operations', () => {
	const base = expectCompiled('1')
	const forged = [
		{ ...base, instructions: [{ op: 'call', function: 'random' }] },
		{ ...base, instructions: [{ op: 'constant', value: 1 }, { op: 'constant', value: 2 }, { op: 'binary', operator: '%' }] },
		{ ...base, instructions: [{ op: 'jump' }] },
		{ ...base, variables: [1] },
		{ ...base, operationLimit: 50_000 },
	] as unknown as FormulaProgram[]
	for (const program of forged) {
		assert.doesNotThrow(() => evaluateFormula(program, {}))
		assert.equal(evaluateFormula(program, {}).ok, false)
	}
})

test('enforces source, token, node, depth and operation budgets', () => {
	assert.equal(expectFormulaError(compileFormula('12345', { variables: [], limits: { maxSourceLength: 4 } })).code, 'source-limit')
	assert.equal(expectFormulaError(compileFormula('1+2+3', { variables: [], limits: { maxTokens: 4 } })).code, 'token-limit')
	assert.equal(expectFormulaError(compileFormula('1+2+3', { variables: [], limits: { maxNodes: 4 } })).code, 'node-limit')
	assert.equal(expectFormulaError(compileFormula('----x', { variables: ['x'], limits: { maxDepth: 3 } })).code, 'depth-limit')
	const budgeted = expectCompiled('x + 1', ['x'])
	assert.equal(expectFormulaError(evaluateFormula({ ...budgeted, operationLimit: 2 }, { x: 1 })).code, 'operation-limit')
})

test('canonical programs serialize, recompile and preserve sorted variable identity', () => {
	const first = expectCompiled('b + a * 2', ['b', 'a'])
	const second = expectCompiled('b + a * 2', ['a', 'b'])
	assert.deepEqual(first, second)
	assert.deepEqual(first.variables, ['a', 'b'])
	assert.equal(Object.isFrozen(first), true)
	assert.equal(Object.isFrozen(first.instructions), true)
	assert.equal(first.instructions.every(Object.isFrozen), true)
	const ast = parseFormula('b + a * 2')
	assert.equal(ast.ok, true)
	if (ast.ok) assert.equal(Object.isFrozen(ast.value), true)
	const serialized = serializeFormulaProgram(first)
	const parsed = parseFormulaProgram(serialized)
	assert.deepEqual(parsed, { ok: true, value: first })
	assert.equal(parseFormulaProgram(serialized.replace('"version":1', '"version":99')).ok, false)
	assert.equal(evaluateFormula({ ...first, version: 99 as 1 }, { a: 1, b: 2 }).ok, false)
})

test('2D transforms execute and serialize tan/atan formula configuration', () => {
	const transform = compileFormulaTransform2D({
		xSource: 'tan(x)',
		ySource: 'atan(y)',
		variables: ['x', 'y'],
	})
	assert.equal(transform.ok, true)
	if (!transform.ok) return
	const evaluated = evaluateFormulaTransform2D(transform.value, { x: 0.25, y: 2 })
	assert.deepEqual(evaluated, { ok: true, value: { x: Math.tan(0.25), y: Math.atan(2) } })
	const serialized = serializeFormulaTransform2D(transform.value)
	assert.deepEqual(parseFormulaTransform2D(serialized), { ok: true, value: transform.value })
})

test('formula-defined experiments execute deterministically and serialize configuration', () => {
	const compiled = compileFormulaExperiment({
		id: 'drooping-formula-fixture',
		xSource: 'tan(x) * scale',
		ySource: 'atan(y) * scale',
		variables: ['x', 'y', 'scale'],
		configuration: { scale: 2 },
	})
	assert.equal(compiled.ok, true)
	if (!compiled.ok) return
	assert.deepEqual(evaluateFormulaExperiment(compiled.value, { x: 0.25, y: 2, scale: 99 }), {
		ok: true,
		value: { x: Math.tan(0.25) * 2, y: Math.atan(2) * 2 },
	})
	const serialized = serializeFormulaExperiment(compiled.value)
	assert.deepEqual(parseFormulaExperiment(serialized), { ok: true, value: compiled.value })
	assert.equal(compileFormulaExperiment({
		id: 'invalid ID', xSource: 'x', ySource: 'y', variables: ['x', 'y'],
	}).ok, false)
	assert.equal(compileFormulaExperiment({
		id: 'unknown-config', xSource: 'x', ySource: 'y', variables: ['x', 'y'], configuration: { scale: 2 },
	}).ok, false)
})

test('bounded fuzz inputs never escape as exceptions', () => {
	let state = 0x12345678
	const alphabet = '0123456789xyz+-*/^(),.[];_ '
	for (let sample = 0; sample < 500; sample++) {
		let source = ''
		for (let index = 0; index < 40; index++) {
			state = (Math.imul(state, 1664525) + 1013904223) >>> 0
			source += alphabet[state % alphabet.length]
		}
		assert.doesNotThrow(() => {
			const compiled = compileFormula(source, { variables: ['x', 'y', 'z'] })
			if (compiled.ok) evaluateFormula(compiled.value, { x: 1, y: 2, z: 3 })
		})
	}
})

test('formula runtime contains no dynamic code generation', async () => {
	const files = (await readdir('src-v2/formula')).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
	const source = (await Promise.all(files.map((file) => readFile(`src-v2/formula/${file}`, 'utf8')))).join('\n')
	assert.doesNotMatch(source, /\beval\s*\(/)
	assert.doesNotMatch(source, /\bFunction\s*\(/)
})

test('versioned backend-conformance fixtures match the deterministic interpreter', async () => {
	const fixture = JSON.parse(await readFile('src-v2/formula/fixtures/v1-conformance.json', 'utf8')) as {
		readonly format: string
		readonly version: number
		readonly cases: readonly {
			readonly id: string
			readonly source: string
			readonly variables: readonly string[]
			readonly scope: Readonly<Record<string, number>>
			readonly expected: number
		}[]
	}
	assert.equal(fixture.format, 'bindfly-formula-conformance')
	assert.equal(fixture.version, 1)
	for (const item of fixture.cases) {
		const result = evaluateFormula(expectCompiled(item.source, item.variables), item.scope)
		assert.equal(result.ok, true, item.id)
		if (result.ok) assert.ok(Math.abs(result.value - item.expected) < 1e-12, item.id)
	}
})
