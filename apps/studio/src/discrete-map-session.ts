import { createPhaseSpaceTransform, getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, ParameterSchema, RendererKind, RenderFrame, Simulation, SimulationStep, Viewport } from '../../../src-v2/core/index.ts'
import {
	compileDiscreteMapPrograms,
	createDiscreteMapScope,
	evaluateDiscreteMap,
} from '../../../src-v2/effects/discrete-map/formula.ts'
import type { DiscreteMapPrograms } from '../../../src-v2/effects/discrete-map/formula.ts'
import { discreteMapParameters } from '../../../src-v2/effects/discrete-map/parameters.ts'
import { beginDiscreteMapConfigurationEpoch, createDiscreteMapSimulation, snapshotDiscreteMapState } from '../../../src-v2/effects/discrete-map/simulation.ts'
import type {
	DiscreteMapInput,
	DiscreteMapParameters,
	DiscreteMapState,
} from '../../../src-v2/effects/discrete-map/types.ts'
import { evaluateFormula, isFormulaConfigurationParameter } from '../../../src-v2/formula/index.ts'
import type { FormulaProgram } from '../../../src-v2/formula/index.ts'
import { createPhasePortraitCanvasRenderer } from '../../../src-v2/rendering/canvas2d/phase-portrait-renderer.ts'
import { createPhasePortraitWebGL2Renderer } from '../../../src-v2/rendering/webgl2/phase-portrait-renderer.ts'
import type { PhasePortraitRenderView } from '../../../src-v2/rendering/phase-portrait.ts'
import { createStage15FrameTimer } from './experiment-session.ts'
import type { ExperimentSession, ExperimentTelemetry } from './experiment-session.ts'
import { requireHtmlCanvas } from './session-renderer.ts'

export interface DiscreteMapProbeAxis {
	readonly value?: number
	readonly error?: string
	readonly trace: readonly { readonly expression: string; readonly value: number }[]
}

export interface DiscreteMapProbe {
	readonly kind: 'discrete-map-probe'
	readonly x: number
	readonly y: number
	readonly n: number
	readonly nextX: DiscreteMapProbeAxis
	readonly nextY: DiscreteMapProbeAxis
}

const probeFormula = (
	program: FormulaProgram,
	scope: Readonly<Record<string, number>>,
): DiscreteMapProbeAxis => {
	const trace: { expression: string; value: number }[] = []
	const result = evaluateFormula(program, scope, (entry) => {
		trace.push({ expression: program.source.slice(entry.start, entry.end), value: entry.value })
	})
	return result.ok ? { value: result.value, trace } : { error: `${result.error.code}: ${result.error.message}`, trace }
}

export const createDiscreteMapSession = (options: {
	readonly canvas: HTMLCanvasElement | OffscreenCanvas
	readonly rendererId?: RendererKind
	readonly parameters: DiscreteMapParameters
	readonly seed: string
	readonly viewport: Viewport
}): ExperimentSession<typeof discreteMapParameters, DiscreteMapInput, DiscreteMapState, ExperimentTelemetry> => {
	let parameters = options.parameters
	let viewport = options.viewport
	const initialPrograms = compileDiscreteMapPrograms(parameters)
	if (!initialPrograms.ok) throw new Error(initialPrograms.error)
	let programs: DiscreteMapPrograms = initialPrograms.value
	const createSimulation = (): Simulation<DiscreteMapState, DiscreteMapInput> => createDiscreteMapSimulation({
		parameters,
		viewport,
		evaluate: (x, y, n) => evaluateDiscreteMap(programs, createDiscreteMapScope(parameters, x, y, n)),
	})
	let simulation = createSimulation()
	const renderer = options.rendererId === 'webgl2'
		? createPhasePortraitWebGL2Renderer(requireHtmlCanvas(options.canvas, 'Discrete Map'))
		: createPhasePortraitCanvasRenderer(options.canvas)
	renderer.resize(viewport)
	const frameTimer = createStage15FrameTimer()
	let droppedSteps = 0
	let telemetry: ExperimentTelemetry = {
		points: simulation.state.orbits.length,
		edges: 0,
		components: simulation.state.orbits.length,
		step: 0,
		frameMs: 0,
		droppedSteps,
		searchBackend: 'brute',
	}
	let disposed = false
	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed discrete-map session.')
	}
	const rebuild = () => {
		simulation.dispose()
		simulation = createSimulation()
	}
	const renderView = (): PhasePortraitRenderView => ({
		background: parameters.background,
		domainRadius: parameters.domainRadius,
		title: 'Discrete map · one Step = one iteration · click to add orbit',
		trajectories: simulation.state.orbits,
		trajectoryStyle: 'points',
	})

	return {
		get parameters() { return parameters },
		get telemetry() { return telemetry },
		step: (step: SimulationStep) => { assertActive(); frameTimer.measureSimulation(() => simulation.step(step)) },
		render: (frame: RenderFrame) => {
			assertActive()
			const startedAt = performance.now()
			const derived = frameTimer.measure(renderView)
			const rendered = frameTimer.measure(() => renderer.render(derived.value, frame))
			const stage15Timing = frameTimer.finish(
				derived.durationMs,
				rendered.value?.renderMs ?? rendered.durationMs,
				rendered.value?.uploadMs ?? 0,
				rendered.value?.gpuRenderMs,
			)
			telemetry = {
				points: simulation.state.orbits.length,
				edges: simulation.state.iteration,
				components: simulation.state.orbits.filter(({ status }) => status === 'active').length,
				step: frame.simulationStepIndex,
				frameMs: performance.now() - startedAt,
				...stage15Timing,
				droppedSteps,
				searchBackend: 'brute',
			}
			return telemetry
		},
		applyInput: (input) => { assertActive(); simulation.applyInput(input) },
		updateParameters: (patch: ParameterPatch<typeof discreteMapParameters>) => {
			assertActive()
			const invalidation = getParameterPatchInvalidation(discreteMapParameters, patch)
			const normalized = normalizeParameters(discreteMapParameters, { ...parameters, ...patch })
			if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid discrete-map parameter patch.')
			const nextPrograms = compileDiscreteMapPrograms(normalized.value)
			if (!nextPrograms.ok) throw new Error(nextPrograms.error)
			const previous = parameters as unknown as Readonly<Record<string, unknown>>
			const schema: ParameterSchema = discreteMapParameters
			const formulaChanged = Object.entries(patch).some(([parameterId, value]) =>
				isFormulaConfigurationParameter(schema[parameterId]) && value !== previous[parameterId])
			parameters = normalized.value
			programs = nextPrograms.value
			if (invalidation === 'reset-simulation') rebuild()
			else if (invalidation === 'hot-update') {
				if (formulaChanged) beginDiscreteMapConfigurationEpoch(simulation.state, parameters.trailLength)
			} else throw new Error('Discrete map requires a runtime rebuild for this patch.')
		},
		resize: (nextViewport) => {
			assertActive()
			viewport = nextViewport
			renderer.resize(viewport)
			simulation.resize(viewport)
		},
		reset: () => { assertActive(); droppedSteps = 0; frameTimer.reset(); simulation.reset() },
		recordDroppedSteps: (count) => {
			assertActive()
			if (!Number.isInteger(count) || count < 0) throw new RangeError('Dropped step count must be a non-negative integer.')
			droppedSteps += count
			telemetry = { ...telemetry, droppedSteps }
		},
		snapshot: () => { assertActive(); return snapshotDiscreteMapState(simulation.state) },
		inspectPoint: ({ x, y }) => {
			assertActive()
			const { x: mathematicalX, y: mathematicalY } = createPhaseSpaceTransform(viewport, parameters.domainRadius).toMathematical({ x, y })
			const scope = createDiscreteMapScope(parameters, mathematicalX, mathematicalY, simulation.state.iteration)
			return {
				kind: 'discrete-map-probe',
				x: mathematicalX,
				y: mathematicalY,
				n: simulation.state.iteration,
				nextX: probeFormula(programs.nextX, scope),
				nextY: probeFormula(programs.nextY, scope),
			} satisfies DiscreteMapProbe
		},
		dispose: () => {
			if (disposed) return
			disposed = true
			simulation.dispose()
			renderer.dispose()
		},
	}
}
