import { createPhaseSpaceTransform, getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, ParameterSchema, RenderFrame, Simulation, SimulationStep, Viewport } from '../../../src-v2/core/index.ts'
import {
	compileVectorFieldPrograms,
	createVectorFieldScope,
	evaluateVectorField,
} from '../../../src-v2/effects/vector-field/formula.ts'
import type { VectorFieldPrograms } from '../../../src-v2/effects/vector-field/formula.ts'
import { vectorFieldParameters } from '../../../src-v2/effects/vector-field/parameters.ts'
import { beginVectorFieldConfigurationEpoch, createVectorFieldSimulation, snapshotVectorFieldState } from '../../../src-v2/effects/vector-field/simulation.ts'
import type {
	VectorFieldInput,
	VectorFieldParameters,
	VectorFieldState,
} from '../../../src-v2/effects/vector-field/types.ts'
import { evaluateFormula, isFormulaConfigurationParameter } from '../../../src-v2/formula/index.ts'
import type { FormulaProgram } from '../../../src-v2/formula/index.ts'
import {
	createPhasePortraitCanvasRenderer,
} from '../../../src-v2/rendering/canvas2d/phase-portrait-renderer.ts'
import type {
	PhasePortraitRenderView,
	VectorFieldSample,
} from '../../../src-v2/rendering/canvas2d/phase-portrait-renderer.ts'
import type { ExperimentSession, ExperimentTelemetry } from './experiment-session.ts'

export interface VectorFieldProbeAxis {
	readonly value?: number
	readonly error?: string
	readonly trace: readonly { readonly expression: string; readonly value: number }[]
}

export interface VectorFieldProbe {
	readonly kind: 'vector-field-probe'
	readonly x: number
	readonly y: number
	readonly t: number
	readonly dx: VectorFieldProbeAxis
	readonly dy: VectorFieldProbeAxis
}

const probeFormula = (
	program: FormulaProgram,
	scope: Readonly<Record<string, number>>,
): VectorFieldProbeAxis => {
	const trace: { expression: string; value: number }[] = []
	const result = evaluateFormula(program, scope, (entry) => {
		trace.push({ expression: program.source.slice(entry.start, entry.end), value: entry.value })
	})
	return result.ok ? { value: result.value, trace } : { error: `${result.error.code}: ${result.error.message}`, trace }
}

export const createVectorFieldSession = (options: {
	readonly canvas: HTMLCanvasElement | OffscreenCanvas
	readonly parameters: VectorFieldParameters
	readonly seed: string
	readonly viewport: Viewport
}): ExperimentSession<typeof vectorFieldParameters, VectorFieldInput, VectorFieldState, ExperimentTelemetry> => {
	let parameters = options.parameters
	let viewport = options.viewport
	let programs: VectorFieldPrograms
	const initialPrograms = compileVectorFieldPrograms(parameters)
	if (!initialPrograms.ok) throw new Error(initialPrograms.error)
	programs = initialPrograms.value
	const createSimulation = (): Simulation<VectorFieldState, VectorFieldInput> => createVectorFieldSimulation({
		parameters,
		viewport,
		evaluate: (x, y, t) => evaluateVectorField(programs, createVectorFieldScope(parameters, x, y, t)),
	})
	let simulation = createSimulation()
	const renderer = createPhasePortraitCanvasRenderer(options.canvas)
	renderer.resize(viewport)
	let droppedSteps = 0
	let telemetry: ExperimentTelemetry = {
		points: simulation.state.trajectories.length,
		edges: 0,
		components: simulation.state.trajectories.length,
		step: 0,
		frameMs: 0,
		droppedSteps,
		searchBackend: 'brute',
	}
	let disposed = false
	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed vector-field session.')
	}
	const rebuild = () => {
		simulation.dispose()
		simulation = createSimulation()
	}
	const fieldSamples = (): readonly VectorFieldSample[] => {
		const samples: VectorFieldSample[] = []
		const density = parameters.fieldDensity
		const bounds = createPhaseSpaceTransform(viewport, parameters.domainRadius).visibleBounds
		const aspect = viewport.cssWidth / viewport.cssHeight
		const rows = aspect >= 1 ? density : Math.max(2, Math.round(density / aspect))
		const columns = aspect >= 1 ? Math.max(2, Math.round(density * aspect)) : density
		for (let row = 0; row < rows; row++) {
			const y = bounds.maxY - (row / (rows - 1)) * (bounds.maxY - bounds.minY)
			for (let column = 0; column < columns; column++) {
				const x = bounds.minX + (column / (columns - 1)) * (bounds.maxX - bounds.minX)
				const evaluated = evaluateVectorField(programs, createVectorFieldScope(parameters, x, y, simulation.state.time))
				if (evaluated.ok) samples.push({ x, y, ...evaluated.value })
			}
		}
		return samples
	}
	const renderView = (): PhasePortraitRenderView => ({
		background: parameters.background,
		domainRadius: parameters.domainRadius,
		title: 'Vector field · RK4 · click to add trajectory',
		trajectories: simulation.state.trajectories,
		field: fieldSamples(),
	})

	return {
		get parameters() { return parameters },
		get telemetry() { return telemetry },
		step: (step: SimulationStep) => { assertActive(); simulation.step(step) },
		render: (frame: RenderFrame) => {
			assertActive()
			const startedAt = performance.now()
			const view = renderView()
			renderer.render(view, frame)
			telemetry = {
				points: simulation.state.trajectories.length,
				edges: view.field?.length ?? 0,
				components: simulation.state.trajectories.filter(({ status }) => status === 'active').length,
				step: frame.simulationStepIndex,
				frameMs: performance.now() - startedAt,
				droppedSteps,
				searchBackend: 'brute',
			}
			return telemetry
		},
		applyInput: (input) => { assertActive(); simulation.applyInput(input) },
		updateParameters: (patch: ParameterPatch<typeof vectorFieldParameters>) => {
			assertActive()
			const invalidation = getParameterPatchInvalidation(vectorFieldParameters, patch)
			const normalized = normalizeParameters(vectorFieldParameters, { ...parameters, ...patch })
			if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid vector-field parameter patch.')
			const nextPrograms = compileVectorFieldPrograms(normalized.value)
			if (!nextPrograms.ok) throw new Error(nextPrograms.error)
			const previous = parameters as unknown as Readonly<Record<string, unknown>>
			const schema: ParameterSchema = vectorFieldParameters
			const formulaChanged = Object.entries(patch).some(([parameterId, value]) =>
				isFormulaConfigurationParameter(schema[parameterId]) && value !== previous[parameterId])
			parameters = normalized.value
			programs = nextPrograms.value
			if (invalidation === 'reset-simulation') rebuild()
			else if (invalidation === 'hot-update') {
				if (formulaChanged) beginVectorFieldConfigurationEpoch(simulation.state, parameters.trailLength)
			} else throw new Error('Vector field requires a runtime rebuild for this patch.')
		},
		resize: (nextViewport) => {
			assertActive()
			viewport = nextViewport
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
		snapshot: () => { assertActive(); return snapshotVectorFieldState(simulation.state) },
		inspectPoint: ({ x, y }) => {
			assertActive()
			const { x: mathematicalX, y: mathematicalY } = createPhaseSpaceTransform(viewport, parameters.domainRadius).toMathematical({ x, y })
			const scope = createVectorFieldScope(parameters, mathematicalX, mathematicalY, simulation.state.time)
			return {
				kind: 'vector-field-probe',
				x: mathematicalX,
				y: mathematicalY,
				t: simulation.state.time,
				dx: probeFormula(programs.dx, scope),
				dy: probeFormula(programs.dy, scope),
			} satisfies VectorFieldProbe
		},
		dispose: () => {
			if (disposed) return
			disposed = true
			simulation.dispose()
			renderer.dispose()
		},
	}
}
