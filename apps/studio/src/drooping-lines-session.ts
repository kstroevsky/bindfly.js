import { createSeededRandom, getParameterPatchInvalidation, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, ParameterValues, RenderFrame, Simulation, SimulationStep, Viewport } from '../../../src-v2/core/index.ts'
import { droopingLinesDefinition, snapshotDroopingLinesState } from '../../../src-v2/effects/drooping-lines/definition.ts'
import { compileDroopingFormulaPair } from '../../../src-v2/effects/drooping-lines/formula.ts'
import { createDroopingGeometry } from '../../../src-v2/effects/drooping-lines/geometry.ts'
import { droopingLinesParameters } from '../../../src-v2/effects/drooping-lines/parameters.ts'
import type { DroopingLinesInput, DroopingLinesState } from '../../../src-v2/effects/drooping-lines/types.ts'
import { MAXIMUM_MOVING_POINT_COUNT } from '../../../src-v2/effects/moving-points/parameters.ts'
import { createDroopingLinesCanvasRenderer } from '../../../src-v2/rendering/canvas2d/drooping-lines-renderer.ts'
import type { DroopingLinesRenderView } from '../../../src-v2/rendering/canvas2d/drooping-lines-renderer.ts'
import type { ExperimentSession, ExperimentTelemetry } from './experiment-session.ts'

export interface CreateDroopingLinesSessionOptions {
	readonly canvas: HTMLCanvasElement | OffscreenCanvas
	readonly parameters: ParameterValues<typeof droopingLinesParameters>
	readonly seed: string
	readonly viewport: Viewport
}

export type DroopingLinesSession = ExperimentSession<
	typeof droopingLinesParameters,
	DroopingLinesInput,
	DroopingLinesState,
	ExperimentTelemetry
>

export const createDroopingLinesSession = (options: CreateDroopingLinesSessionOptions): DroopingLinesSession => {
	let parameters = options.parameters
	const initialFormulas = compileDroopingFormulaPair(parameters)
	if (!initialFormulas.ok) throw new Error(initialFormulas.error)
	let formulas = initialFormulas.value
	let viewport = options.viewport
	let simulation: Simulation<DroopingLinesState, DroopingLinesInput> = droopingLinesDefinition.createSimulation({
		random: createSeededRandom(options.seed), viewport,
	}, parameters)
	const geometry = createDroopingGeometry(MAXIMUM_MOVING_POINT_COUNT)
	const renderer = createDroopingLinesCanvasRenderer(options.canvas)
	const view: DroopingLinesRenderView = {
		background: parameters.background,
		particles: simulation.state.particles,
		lines: geometry.result,
	}
	let droppedSteps = 0
	let telemetry: ExperimentTelemetry = {
		points: simulation.state.particles.count,
		edges: 0,
		components: 0,
		step: 0,
		frameMs: 0,
		droppedSteps,
		searchBackend: 'brute',
	}
	let disposed = false
	const assertActive = () => {
		if (disposed) throw new Error('Cannot use a disposed Drooping Lines session.')
	}
	const rebuild = () => {
		simulation.dispose()
		simulation = droopingLinesDefinition.createSimulation({ random: createSeededRandom(options.seed), viewport }, parameters)
		Object.assign(view, { background: parameters.background, particles: simulation.state.particles })
	}

	return {
		get parameters() { return parameters },
		get telemetry() { return telemetry },
		step: (step: SimulationStep) => { assertActive(); simulation.step(step) },
		render: (frame: RenderFrame) => {
			assertActive()
			const startedAt = performance.now()
			const lines = geometry.update({
				particles: simulation.state.particles,
				connectionRadius: parameters.connectionRadius,
				formulaA: formulas.a,
				formulaB: formulas.b,
				formulaMorph: parameters.formulaMorph,
			})
			renderer.render(view, frame)
			telemetry = {
				points: simulation.state.particles.count,
				edges: lines.count,
				components: 0,
				step: frame.simulationStepIndex,
				frameMs: performance.now() - startedAt,
				droppedSteps,
				searchBackend: 'brute',
			}
			return telemetry
		},
		applyInput: (input: DroopingLinesInput) => { assertActive(); simulation.applyInput(input) },
		updateParameters: (patch: ParameterPatch<typeof droopingLinesParameters>) => {
			assertActive()
			const invalidation = getParameterPatchInvalidation(droopingLinesParameters, patch)
			const normalized = normalizeParameters(droopingLinesParameters, { ...parameters, ...patch })
			if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid Drooping Lines parameter patch.')
			const nextFormulas = compileDroopingFormulaPair(normalized.value)
			if (!nextFormulas.ok) throw new Error(nextFormulas.error)
			parameters = normalized.value
			formulas = nextFormulas.value
			if (invalidation === 'hot-update') Object.assign(view, { background: parameters.background })
			else if (invalidation === 'reset-simulation') rebuild()
			else throw new Error('Drooping Lines requires a runtime rebuild for this parameter patch.')
		},
		resize: (nextViewport: Viewport) => {
			assertActive()
			viewport = nextViewport
			renderer.resize(viewport)
			simulation.resize(viewport)
		},
		reset: () => { assertActive(); droppedSteps = 0; simulation.reset() },
		recordDroppedSteps: (count: number) => {
			assertActive()
			if (!Number.isInteger(count) || count < 0) throw new RangeError('Dropped step count must be a non-negative integer.')
			droppedSteps += count
			telemetry = { ...telemetry, droppedSteps }
		},
		snapshot: () => { assertActive(); return snapshotDroopingLinesState(simulation.state) },
		dispose: () => {
			if (disposed) return
			disposed = true
			simulation.dispose()
			geometry.dispose()
			renderer.dispose()
		},
	}
}
