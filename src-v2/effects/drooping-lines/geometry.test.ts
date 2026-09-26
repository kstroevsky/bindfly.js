import assert from 'node:assert/strict'
import test from 'node:test'

import { compileDroopingFormulaPair } from './formula.ts'
import { createDroopingGeometry } from './geometry.ts'
import { droopingLinesParameters } from './parameters.ts'

const particles = {
	count: 2,
	capacity: 2,
	ids: new Uint32Array([0, 1]),
	x: new Float64Array([0, 1]),
	y: new Float64Array([0, 1]),
	velocityX: new Float64Array(2),
	velocityY: new Float64Array(2),
	lifeSeconds: new Float64Array(2),
}

test('derives the two legacy Drooping Lines coordinate transformations', () => {
	const geometry = createDroopingGeometry(2)
	const formulas = compileDroopingFormulaPair({
		formulaAX: droopingLinesParameters.formulaAX.default,
		formulaAY: droopingLinesParameters.formulaAY.default,
		formulaBX: droopingLinesParameters.formulaBX.default,
		formulaBY: droopingLinesParameters.formulaBY.default,
	})
	assert.equal(formulas.ok, true)
	if (!formulas.ok) return
	const tangent = geometry.update({ particles, connectionRadius: 10, formulaA: formulas.value.a, formulaB: formulas.value.b, formulaMorph: 0 })
	assert.equal(tangent.count, 4)
	assert.equal(tangent.sourceX[2], Math.tan(1))
	assert.equal(tangent.sourceY[2], 1)

	const arctangent = geometry.update({ particles, connectionRadius: 10, formulaA: formulas.value.a, formulaB: formulas.value.b, formulaMorph: 1 })
	assert.equal(arctangent.count, 4)
	assert.equal(arctangent.sourceX[2], 1)
	assert.equal(arctangent.sourceY[2], Math.atan(1))
	assert.equal(arctangent.targetX[2], 0)
	assert.equal(arctangent.targetY[2], 0)

	const midpoint = geometry.update({ particles, connectionRadius: 10, formulaA: formulas.value.a, formulaB: formulas.value.b, formulaMorph: 0.5 })
	assert.equal(midpoint.sourceX[2], (Math.tan(1) + 1) / 2)
	assert.equal(midpoint.sourceY[2], (1 + Math.atan(1)) / 2)
})
