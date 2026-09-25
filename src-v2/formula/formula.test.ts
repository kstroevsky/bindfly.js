import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

import type { Result } from '../core/index.ts'
import type { FormulaIssue, FormulaProgram } from './contracts.ts'
import {
	compileFormula,
	compileBindflyOriginal,
	compileFormulaExperiment,
	compileFormulaTransform2D,
	evaluateFormula,
	evaluateFormulaExperiment,
	evaluateFormulaTransformComparison2D,
	evaluateFormulaTransformComparisonDetailed2D,
	evaluateFormulaTransform2D,
	parseFormula,
	parseFormulaProgram,
	parseFormulaExperiment,
	parseFormulaTransform2D,
	serializeFormulaProgram,
	serializeFormulaExperiment,
	serializeFormulaTransform2D,
	bindflyOriginals,
	createFormulaParameterSchema,
	defineFormulaParameterDeclarations,
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

test('declared formula parameters extend scope without colliding with system symbols or functions', () => {
	const declarations = defineFormulaParameterDeclarations([
		{ id: 'k', default: 1, min: -2, max: 2, step: 0.1 },
		{ id: 'b', default: 0, min: -10, max: 10, step: 0.5 },
	] as const, ['x', 'y', 'angle'])
	assert.deepEqual(Object.keys(createFormulaParameterSchema(declarations)), ['k', 'b'])
	assert.throws(() => defineFormulaParameterDeclarations([
		{ id: 'sin', default: 1, min: 0, max: 2, step: 0.1 },
	], ['x']), /collides/)
	assert.throws(() => defineFormulaParameterDeclarations([
		{ id: 'angle', default: 1, min: 0, max: 2, step: 0.1 },
	], ['angle']), /collides/)
	assert.throws(() => defineFormulaParameterDeclarations([
		{ id: 'k', default: 1, min: 0, max: 2, step: 0.1 },
		{ id: 'k', default: 1, min: 0, max: 2, step: 0.1 },
	], ['x']), /Duplicate/)
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

test('traces the canonical VM with compiler-owned source spans', () => {
	const source = 'tan(distance) * weight * cos(angle * exp(a))'
	const program = expectCompiled(source, ['a', 'angle', 'distance', 'weight'])
	const trace: Array<{ source: string; value: number }> = []
	const result = evaluateFormula(program, { a: 1, angle: 0.25, distance: 0.5, weight: 2 }, (entry) => {
		trace.push({ source: source.slice(entry.start, entry.end), value: entry.value })
	})
	assert.equal(result.ok, true)
	assert.ok(trace.some((entry) => entry.source === 'tan(distance)'))
	assert.ok(trace.some((entry) => entry.source === 'exp(a)'))
	assert.ok(trace.some((entry) => entry.source === 'angle * exp(a)'))
	assert.ok(trace.some((entry) => entry.source === 'cos(angle * exp(a))'))
	assert.equal(trace.at(-1)?.source, source)

	const serialized = JSON.parse(serializeFormulaProgram(program)) as Record<string, unknown>
	serialized.traceSites = [{ instructionIndex: 0, nodeId: 0, start: 999, end: 1000 }]
	const reparsed = parseFormulaProgram(serialized)
	assert.equal(reparsed.ok, true)
	if (reparsed.ok) assert.notDeepEqual(reparsed.value.traceSites, serialized.traceSites)
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

test('formula morphing evaluates synchronized A/B outputs and interpolates coordinates', () => {
	const a = compileFormulaTransform2D({ xSource: 'x', ySource: 'y', variables: ['x', 'y'] })
	const b = compileFormulaTransform2D({ xSource: 'x * 3', ySource: 'y * -1', variables: ['x', 'y'] })
	assert.equal(a.ok, true)
	assert.equal(b.ok, true)
	if (!a.ok || !b.ok) return
	assert.deepEqual(evaluateFormulaTransformComparison2D({ a: a.value, b: b.value, morph: 0.25 }, { x: 4, y: 8 }), {
		ok: true,
		value: {
			a: { x: 4, y: 8 },
			b: { x: 12, y: -8 },
			morphed: { x: 6, y: 4 },
		},
	})
	assert.equal(evaluateFormulaTransformComparison2D({ a: a.value, b: b.value, morph: -0.1 }, { x: 4, y: 8 }).ok, false)
	assert.equal(evaluateFormulaTransformComparison2D({ a: a.value, b: b.value, morph: 1.1 }, { x: 4, y: 8 }).ok, false)
})

test('detailed formula comparison preserves side-specific domain failures', () => {
	const a = compileFormulaTransform2D({ xSource: 'sqrt(x)', ySource: 'y', variables: ['x', 'y'] })
	const b = compileFormulaTransform2D({ xSource: 'x * 2', ySource: 'y * 3', variables: ['x', 'y'] })
	assert.equal(a.ok, true)
	assert.equal(b.ok, true)
	if (!a.ok || !b.ok) return

	const detailed = evaluateFormulaTransformComparisonDetailed2D({ a: a.value, b: b.value, morph: 0.5 }, { x: -1, y: 2 })
	assert.equal(detailed.ok, true)
	if (!detailed.ok) return
	assert.equal(detailed.value.a.ok, false)
	assert.deepEqual(detailed.value.b, { ok: true, value: { x: -2, y: 6 } })
	assert.equal(detailed.value.morphed, undefined)
	assert.equal(evaluateFormulaTransformComparison2D({ a: a.value, b: b.value, morph: 0.5 }, { x: -1, y: 2 }).ok, false)
})

test('Bindfly Originals preserve frozen source provenance and exact legacy coordinate formulas', async () => {
	assert.deepEqual(Object.keys(bindflyOriginals), [
		'drooping-tan-x', 'drooping-atan-y', 'pulse-2023', 'spiral-1', 'spiral-2', 'spiral-3',
	])
	const scope = { a: 2.7, angle: 0.4, distance: 5, positionX: 100, positionY: 80, weight: 0.25 }
	const expected = {
		'pulse-2023': {
			x: scope.positionX + scope.distance * Math.cos(scope.a) * -1,
			y: scope.positionY + Math.tan(scope.distance) * scope.weight * Math.cos(scope.angle * Math.exp(scope.a)) * Math.atan(scope.a),
		},
		'spiral-1': {
			x: scope.positionX + scope.distance * Math.cos(scope.angle * Math.exp(scope.a)) * Math.sin(scope.a),
			y: scope.positionY + scope.distance * Math.cos(scope.a) * -1,
		},
		'spiral-2': {
			x: scope.positionX + scope.distance * Math.cos(scope.angle * Math.exp(scope.a)) * Math.atan(scope.a),
			y: scope.positionY + scope.distance * Math.cos(scope.a) * -1,
		},
		'spiral-3': {
			x: scope.positionX + scope.distance * Math.cos(scope.angle * Math.exp(scope.a)) * Math.atan(scope.a),
			y: scope.positionY + scope.distance * Math.cos(Math.sin(scope.a)) * -1,
		},
	} as const
	for (const original of Object.values(bindflyOriginals)) {
		const source = await readFile(original.provenance.legacyPath)
		const hash = createHash('sha1')
			.update(`blob ${source.byteLength}\0`)
			.update(source)
			.digest('hex')
		assert.equal(hash, original.provenance.legacyGitBlob, original.id)
		assert.equal(Object.isFrozen(original.provenance), true)
	}
	for (const id of Object.keys(expected) as (keyof typeof expected)[]) {
		const compiled = compileBindflyOriginal(id)
		assert.equal(compiled.ok, true, id)
		if (!compiled.ok) continue
		assert.deepEqual(evaluateFormulaExperiment(compiled.value, scope), { ok: true, value: expected[id] })
	}
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
