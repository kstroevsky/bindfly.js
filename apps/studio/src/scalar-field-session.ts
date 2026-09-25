import { createPhaseSpaceTransform, getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, ParameterSchema, RenderFrame, Simulation, SimulationStep, Viewport } from '../../../src-v2/core/index.ts'
import {
	compileScalarFieldProgram,
	createScalarFieldScope,
	evaluateScalarField,
} from '../../../src-v2/effects/scalar-field/formula.ts'
import { scalarFieldParameters } from '../../../src-v2/effects/scalar-field/parameters.ts'
import { sampleScalarField } from '../../../src-v2/effects/scalar-field/sampling.ts'
import { createScalarFieldSimulation, snapshotScalarFieldState } from '../../../src-v2/effects/scalar-field/simulation.ts'
import type {
	ScalarFieldInput,
	ScalarFieldParameters,
	ScalarFieldSampleGrid,
	ScalarFieldState,
} from '../../../src-v2/effects/scalar-field/types.ts'
import { evaluateFormula, isFormulaConfigurationParameter } from '../../../src-v2/formula/index.ts'
import type { FormulaProgram } from '../../../src-v2/formula/index.ts'
import { createScalarFieldCanvasRenderer } from '../../../src-v2/rendering/canvas2d/scalar-field-renderer.ts'
import type { ExperimentSession, ExperimentTelemetry } from './experiment-session.ts'

export interface ScalarFieldProbe {
	readonly kind: 'scalar-field-probe'
	readonly x: number
	readonly y: number
	readonly value?: number
	readonly error?: string
	readonly trace: readonly { readonly expression: string; readonly value: number }[]
}

const probeFormula = (
	program: FormulaProgram,
	scope: Readonly<Record<string, number>>,
): Pick<ScalarFieldProbe, 'value' | 'error' | 'trace'> => {
	const trace: { expression: string; value: number }[] = []
	const result = evaluateFormula(program, scope, (entry) => {
		trace.push({ expression: program.source.slice(entry.start, entry.end), value: entry.value })
	})
	return result.ok ? { value: result.value, trace } : { error: `${result.error.code}: ${result.error.message}`, trace }
}

export const createScalarFieldSession = (options: {
	readonly canvas: HTMLCanvasElement | OffscreenCanvas
	readonly parameters: ScalarFieldParameters
	readonly seed: string
	readonly viewport: Viewport
}): ExperimentSession<typeof scalarFieldParameters, ScalarFieldInput, ScalarFieldState, ExperimentTelemetry> => {
	let parameters = options.parameters
	let viewport = options.viewport
	const initialProgram = compileScalarFieldProgram(parameters)
	if (!initialProgram.ok) throw new Error(initialProgram.error)
	let program: FormulaProgram = initialProgram.value
	const createSimulation = (): Simulation<ScalarFieldState, ScalarFieldInput> => createScalarFieldSimulation()
	const simulation = createSimulation()
	const renderer = createScalarFieldCanvasRenderer(options.canvas)
	renderer.resize(viewport)
	let sampled: ScalarFieldSampleGrid | undefined
	let sampleDirty = true
	let droppedSteps = 0
	let telemetry: ExperimentTelemetry = {
		points: 0,
		edges: 0,
		components: 0,
		step: 0,
		frameMs: 0,
		droppedSteps,
		searchBackend: 'brute',
	}
	let disposed = false
	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed scalar-field session.')
	}
	const grid = (): ScalarFieldSampleGrid => {
		if (!sampled || sampleDirty) {
			sampled = sampleScalarField({
				viewport,
				domainRadius: parameters.domainRadius,
				sampleDensity: parameters.sampleDensity,
				evaluate: (x, y) => evaluateScalarField(program, createScalarFieldScope(parameters, x, y)),
			})
			sampleDirty = false
		}
		return sampled
	}

	return {
		get parameters() { return parameters },
		get telemetry() { return telemetry },
		step: (step: SimulationStep) => { assertActive(); simulation.step(step) },
		render: (frame: RenderFrame) => {
			assertActive()
			const startedAt = performance.now()
			const currentGrid = grid()
			renderer.render({
				background: parameters.background,
				domainRadius: parameters.domainRadius,
				title: 'Scalar field · sampled z = f(x,y) · piecewise-linear level set',
				grid: currentGrid,
				contourLevel: parameters.contourLevel,
				valueScale: parameters.valueScale,
			}, frame)
			telemetry = {
				points: currentGrid.validCount,
				edges: currentGrid.invalidCount,
				components: 0,
				step: frame.simulationStepIndex,
				frameMs: performance.now() - startedAt,
				droppedSteps,
				searchBackend: 'brute',
			}
			return telemetry
		},
		applyInput: (_input: ScalarFieldInput) => { assertActive(); throw new Error('Scalar fields do not accept simulation input.') },
		updateParameters: (patch: ParameterPatch<typeof scalarFieldParameters>) => {
			assertActive()
			const invalidation = getParameterPatchInvalidation(scalarFieldParameters, patch)
			if (invalidation !== 'hot-update') throw new Error('Scalar field supports hot parameter updates only.')
			const normalized = normalizeParameters(scalarFieldParameters, { ...parameters, ...patch })
			if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid scalar-field parameter patch.')
			const nextProgram = compileScalarFieldProgram(normalized.value)
			if (!nextProgram.ok) throw new Error(nextProgram.error)
			const schema: ParameterSchema = scalarFieldParameters
			const resample = Object.keys(patch).some((parameterId) =>
				parameterId === 'domainRadius'
				|| parameterId === 'sampleDensity'
				|| isFormulaConfigurationParameter(schema[parameterId]))
			parameters = normalized.value
			program = nextProgram.value
			if (resample) sampleDirty = true
		},
		resize: (nextViewport) => {
			assertActive()
			viewport = nextViewport
			sampleDirty = true
			renderer.resize(viewport)
			simulation.resize(viewport)
		},
		reset: () => { assertActive(); droppedSteps = 0; simulation.reset() },
		recordDroppedSteps: (count) => {
			assertActive()
			if (!Number.isInteger(count) || count < 0) throw new RangeError('Dropped step count must be a non-negative integer.')
			droppedSteps += count
			telemetry = { ...telemetry, droppedSteps }
		},
		snapshot: () => { assertActive(); return snapshotScalarFieldState(simulation.state) },
		inspectPoint: ({ x, y }) => {
			assertActive()
			const mathematical = createPhaseSpaceTransform(viewport, parameters.domainRadius).toMathematical({ x, y })
			return {
				kind: 'scalar-field-probe',
				x: mathematical.x,
				y: mathematical.y,
				...probeFormula(program, createScalarFieldScope(parameters, mathematical.x, mathematical.y)),
			} satisfies ScalarFieldProbe
		},
		dispose: () => {
			if (disposed) return
			disposed = true
			simulation.dispose()
			renderer.dispose()
		},
	}
}
