import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { AnalysisScheduler } from '../../../src-v2/analysis/analysis-scheduler.ts'
import type { ScheduledAnalysisResult } from '../../../src-v2/analysis/analysis-scheduler.ts'
import { isPointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import type { PointCloudSnapshot, PointCloudSnapshotSource } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import { RIPS_COMPLEX_ANALYZER_ID, RIPS_COMPLEX_ANALYZER_VERSION } from '../../../src-v2/analysis/rips-complex.ts'
import type { RipsComplexResult } from '../../../src-v2/analysis/rips-complex.ts'
import { countPersistenceIntervalsAt, RIPS_PERSISTENCE_ANALYZER_ID, RIPS_PERSISTENCE_ANALYZER_VERSION } from '../../../src-v2/analysis/rips-persistence.ts'
import type { RipsPersistenceResult } from '../../../src-v2/analysis/rips-persistence.ts'
import type { RendererKind } from '../../../src-v2/core/capabilities.ts'
import { createViewport } from '../../../src-v2/core/viewport.ts'
import { probeWorkerCanvasSupport } from '../../../src-v2/runtime/worker-runtime.ts'
import type { WorkerCanvasCapability } from '../../../src-v2/runtime/worker-runtime.ts'
import { AnalysisWorkerClient } from './analysis-worker-client.ts'
import { ParameterControls } from './parameter-controls.tsx'
import { PersistenceViews } from './persistence-views.tsx'
import { renderRipsAnalysisCanvas } from './rips-analysis-canvas.ts'
import { createMainStudioController, createWorkerStudioController } from './studio-controller.ts'
import type { StudioController, StudioMetrics, StudioRuntimeKind } from './studio-controller.ts'
import { appendFormulaPerturbation, createFormulaPerturbationNode } from './formula-perturbation-history.ts'
import type { FormulaPerturbationNode } from './formula-perturbation-history.ts'
import { DEFAULT_STUDIO_EXPERIMENT_ID, getStudioExperimentPlugin, listStudioExperimentPlugins } from './studio-experiment-registry.ts'
import type { StudioExperimentPlugin, StudioFormulaView, StudioParameterValues, StudioPointInspectionView, StudioPointerEvent } from './studio-experiment-plugin.ts'
import { canonicalStringify, createShareArtifact, createStudioConfiguration, createStudioDurableState, createStudioExportDocument, parseStudioImportDocument, readStudioStateFromUrl, resolveStudioDurableState } from './studio-state.ts'
import type { StudioWorkspace } from './studio-state.ts'

const EMPTY_METRICS: StudioMetrics = {
	points: 0, edges: 0, components: 0, step: 0, frameMs: 0, droppedSteps: 0, searchBackend: 'brute',
}
const EXPERIMENTS = listStudioExperimentPlugins()
const INITIAL_URL_STATE = readStudioStateFromUrl(new URL(window.location.href))
const INITIAL_RESOLVED_STATE = INITIAL_URL_STATE.ok ? INITIAL_URL_STATE.value : undefined
const routeExperimentId = /^#\/lab\/([^?]+)/.exec(window.location.hash)?.[1]
const initialExperimentId = INITIAL_RESOLVED_STATE?.experimentId ?? routeExperimentId ?? DEFAULT_STUDIO_EXPERIMENT_ID
const INITIAL_PLUGIN = getStudioExperimentPlugin(initialExperimentId) ?? getStudioExperimentPlugin(DEFAULT_STUDIO_EXPERIMENT_ID)
if (!INITIAL_PLUGIN) throw new Error('The default Studio experiment is not registered.')
const INITIAL_RUNTIME: StudioRuntimeKind = INITIAL_RESOLVED_STATE?.runtime
	?? (new URL(window.location.href).searchParams.get('runtime') === 'worker' ? 'worker' : 'main')
const STAGE_15_BENCHMARK_MODE = new URL(window.location.href).searchParams.get('stage15Benchmark') === '1'
const INITIAL_PARAMETERS = INITIAL_RESOLVED_STATE?.parameters ?? INITIAL_PLUGIN.defaultParameters
const INITIAL_SEED = INITIAL_RESOLVED_STATE?.seed ?? INITIAL_PLUGIN.defaultSeed
const INITIAL_STUDIO = INITIAL_RESOLVED_STATE?.studio ?? createStudioConfiguration(INITIAL_PLUGIN, INITIAL_RUNTIME)
const INITIAL_RENDERER = INITIAL_STUDIO.renderer
const INITIAL_ERROR = INITIAL_URL_STATE.ok ? undefined : INITIAL_URL_STATE.error

const pointFor = (event: ReactPointerEvent<HTMLCanvasElement>) => {
	const bounds = event.currentTarget.getBoundingClientRect()
	return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

const supportsWorker = (plugin: StudioExperimentPlugin) => plugin.executionProfiles.some(
	({ rendererId, runtimeId }) => rendererId === 'canvas2d' && runtimeId === 'worker',
)

const supportsExecutionProfile = (
	plugin: StudioExperimentPlugin,
	rendererId: RendererKind,
	runtime: StudioRuntimeKind,
) => plugin.executionProfiles.some((profile) =>
	profile.rendererId === rendererId && profile.runtimeId === (runtime === 'worker' ? 'worker' : 'main-thread'))

const pointCloudSourceLabel = (source: PointCloudSnapshotSource) => source === 'formula-a'
	? 'Formula A'
	: source === 'formula-b' ? 'Formula B' : 'Morph'

const FORMULA_VIEW_LABELS: Readonly<Record<StudioFormulaView, string>> = {
	morph: 'Morph',
	'formula-a': 'Formula A',
	compare: 'A / B',
	'difference-vector': 'Difference vectors',
	'difference-magnitude': 'Difference magnitude',
	'formula-b': 'Formula B',
}
const PERSISTENCE_EPSILON_MAX_OPTIONS = [250, 500, 1000, 2000] as const

export const StudioApp = () => {
	const [plugin, setPlugin] = useState(INITIAL_PLUGIN)
	const [parameters, setParameters] = useState<StudioParameterValues>(INITIAL_PARAMETERS)
	const [seed, setSeed] = useState(INITIAL_SEED)
	const [rendererKind, setRendererKind] = useState<RendererKind>(INITIAL_RENDERER)
	const [runtimeKind, setRuntimeKind] = useState<StudioRuntimeKind>(INITIAL_RUNTIME)
	const [workerCapability, setWorkerCapability] = useState<WorkerCanvasCapability>({ supported: false, reason: 'Checking browser capability.' })
	const [metrics, setMetrics] = useState<StudioMetrics>(EMPTY_METRICS)
	const [paused, setPaused] = useState(STAGE_15_BENCHMARK_MODE && INITIAL_PLUGIN.temporalSemantics.kind !== 'static')
	const [workspace, setWorkspace] = useState<StudioWorkspace>(INITIAL_STUDIO.workspace)
	const [formulaView, setFormulaView] = useState<StudioFormulaView>(INITIAL_STUDIO.formulaView)
	const [probeEnabled, setProbeEnabled] = useState(false)
	const [inspection, setInspection] = useState<StudioPointInspectionView | undefined>()
	const [analysisSource, setAnalysisSource] = useState<PointCloudSnapshotSource>(INITIAL_STUDIO.analysis.source)
	const [analysisEpsilon, setAnalysisEpsilon] = useState(INITIAL_STUDIO.analysis.epsilon)
	const [analysisEpsilonMax, setAnalysisEpsilonMax] = useState(INITIAL_STUDIO.analysis.epsilonMax)
	const [analysisSnapshot, setAnalysisSnapshot] = useState<PointCloudSnapshot | undefined>()
	const [analysisResult, setAnalysisResult] = useState<ScheduledAnalysisResult<{ readonly epsilon: number }, RipsComplexResult> | undefined>()
	const [persistenceResult, setPersistenceResult] = useState<ScheduledAnalysisResult<{ readonly epsilonMax: number }, RipsPersistenceResult> | undefined>()
	const [analysisPending, setAnalysisPending] = useState(false)
	const [persistencePending, setPersistencePending] = useState(false)
	const [formulaHistory, setFormulaHistory] = useState<readonly FormulaPerturbationNode[]>([])
	const [frozenSimulationSnapshotId, setFrozenSimulationSnapshotId] = useState<string | undefined>()
	const [error, setError] = useState<string | undefined>(INITIAL_ERROR)
	const [shareStatus, setShareStatus] = useState(INITIAL_RESOLVED_STATE?.migratedFrom ? 'Legacy preset migrated.' : '')
	const [stateGeneration, setStateGeneration] = useState(0)
	const [canWriteUrl, setCanWriteUrl] = useState(INITIAL_URL_STATE.ok)
	const runtimeConfigurationRef = useRef({
		plugin: INITIAL_PLUGIN, parameters: INITIAL_PARAMETERS, formulaView: INITIAL_STUDIO.formulaView, seed: INITIAL_SEED,
	})
	const interactionRef = useRef<ReturnType<StudioExperimentPlugin['createInteractionController']> | null>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const analysisCanvasRef = useRef<HTMLCanvasElement>(null)
	const viewportRef = useRef<HTMLElement>(null)
	const controllerRef = useRef<StudioController>()
	const metricsRef = useRef(metrics)
	const analysisSchedulerRef = useRef<AnalysisScheduler>()
	const analysisWorkerRef = useRef<AnalysisWorkerClient>()
	const analysisRunCounterRef = useRef(0)
	const persistenceSchedulerRef = useRef<AnalysisScheduler>()
	const persistenceWorkerRef = useRef<AnalysisWorkerClient>()
	const persistenceRunCounterRef = useRef(0)
	const formulaHistoryCounterRef = useRef(0)
	const frozenSnapshotCounterRef = useRef(0)

	const hasFormulaHistory = Object.values(plugin.parameters).some(
		(definition) => definition.kind === 'string' && definition.control === 'formula',
	)
	const historyMetrics = (): FormulaPerturbationNode['metrics'] => ({
		step: metricsRef.current.step,
		points: metricsRef.current.points,
		edges: metricsRef.current.edges,
		components: metricsRef.current.components,
	})
	const nextFrozenSnapshotId = () => `${plugin.id}:generation-${stateGeneration}:frozen-${++frozenSnapshotCounterRef.current}`
	const resetFormulaHistory = (snapshotId?: string, nextParameters: StudioParameterValues = parameters, label = 'Frozen frame') => {
		if (!snapshotId || !hasFormulaHistory) {
			setFrozenSimulationSnapshotId(snapshotId)
			setFormulaHistory([])
			return
		}
		setFrozenSimulationSnapshotId(snapshotId)
		setFormulaHistory([createFormulaPerturbationNode({
			id: `${snapshotId}:node-${++formulaHistoryCounterRef.current}`,
			label,
			simulationSnapshotId: snapshotId,
			schema: plugin.parameters,
			parameters: nextParameters,
			metrics: historyMetrics(),
		})])
	}

	const clearPinnedAnalysis = (nextPlugin?: StudioExperimentPlugin) => {
		analysisSchedulerRef.current?.cancel()
		persistenceSchedulerRef.current?.cancel()
		analysisRunCounterRef.current += 1
		persistenceRunCounterRef.current += 1
		setAnalysisPending(false)
		setPersistencePending(false)
		setAnalysisSnapshot(undefined)
		setAnalysisResult(undefined)
		setPersistenceResult(undefined)
		if (nextPlugin) setAnalysisSource(nextPlugin.pointCloudSources[0] ?? 'morph')
	}

	const selectRuntime = (runtime: StudioRuntimeKind) => {
		resetFormulaHistory()
		setPaused(false)
		metricsRef.current = EMPTY_METRICS
		setMetrics(EMPTY_METRICS)
		setInspection(undefined)
		if (runtime === 'worker') setRendererKind('canvas2d')
		setRuntimeKind(runtime)
		setCanWriteUrl(true)
	}

	const selectRenderer = (renderer: RendererKind) => {
		const nextRuntime: StudioRuntimeKind = renderer === 'canvas2d' ? runtimeKind : 'main'
		if (!supportsExecutionProfile(plugin, renderer, nextRuntime)) {
			setError(`Experiment '${plugin.id}' does not support the ${renderer}/${nextRuntime} profile.`)
			return
		}
		resetFormulaHistory()
		setPaused(STAGE_15_BENCHMARK_MODE && plugin.temporalSemantics.kind !== 'static')
		metricsRef.current = EMPTY_METRICS
		setMetrics(EMPTY_METRICS)
		setInspection(undefined)
		setRendererKind(renderer)
		setRuntimeKind(nextRuntime)
		setError(undefined)
		setCanWriteUrl(true)
	}

	const selectExperiment = (experimentId: string) => {
		const nextPlugin = getStudioExperimentPlugin(experimentId)
		if (!nextPlugin) { setError(`Experiment '${experimentId}' is not registered.`); return }
		let nextRenderer = rendererKind
		let nextRuntime = runtimeKind
		if (!supportsExecutionProfile(nextPlugin, nextRenderer, nextRuntime)) {
			if (supportsExecutionProfile(nextPlugin, nextRenderer, 'main')) nextRuntime = 'main'
			else {
				nextRenderer = 'canvas2d'
				nextRuntime = runtimeKind === 'worker' && supportsWorker(nextPlugin) ? 'worker' : 'main'
			}
		}
		setPlugin(nextPlugin)
		setParameters(nextPlugin.defaultParameters)
		setSeed(nextPlugin.defaultSeed)
		setRendererKind(nextRenderer)
		setRuntimeKind(nextRuntime)
		metricsRef.current = EMPTY_METRICS
		setMetrics(EMPTY_METRICS)
		setPaused(false)
		setProbeEnabled(false)
		setInspection(undefined)
		setWorkspace('explore')
		setFormulaView(nextPlugin.formulaViews[0] ?? 'morph')
		setFormulaHistory([])
		setFrozenSimulationSnapshotId(undefined)
		clearPinnedAnalysis(nextPlugin)
		setError(undefined)
		setCanWriteUrl(true)
		setStateGeneration((generation) => generation + 1)
		runtimeConfigurationRef.current = {
			plugin: nextPlugin,
			parameters: nextPlugin.defaultParameters,
			formulaView: nextPlugin.formulaViews[0] ?? 'morph',
			seed: nextPlugin.defaultSeed,
		}
	}

	useEffect(() => {
		interactionRef.current = plugin.createInteractionController()
	}, [plugin])

	useEffect(() => () => {
		analysisSchedulerRef.current?.dispose()
		analysisWorkerRef.current?.dispose()
		persistenceSchedulerRef.current?.dispose()
		persistenceWorkerRef.current?.dispose()
	}, [])

	useEffect(() => {
		if (workspace !== 'analyze' || !analysisSnapshot || !analysisResult) return
		const canvas = analysisCanvasRef.current
		if (!canvas) return
		const render = () => renderRipsAnalysisCanvas(canvas, { snapshot: analysisSnapshot, result: analysisResult.value })
		render()
		const observer = new ResizeObserver(render)
		observer.observe(canvas)
		return () => observer.disconnect()
	}, [analysisResult, analysisSnapshot, workspace])

	useEffect(() => {
		if (!canWriteUrl) return
		const artifact = createShareArtifact(
			new URL(window.location.href),
			createStudioDurableState(plugin, parameters, seed, runtimeKind, {
				renderer: rendererKind,
				workspace,
				formulaView,
				analysis: { source: analysisSource, epsilon: analysisEpsilon, epsilonMax: analysisEpsilonMax },
			}),
		)
		if (artifact.kind === 'url') window.history.replaceState(null, '', artifact.url)
	}, [analysisEpsilon, analysisEpsilonMax, analysisSource, canWriteUrl, formulaView, parameters, plugin, rendererKind, runtimeKind, seed, workspace])

	useEffect(() => {
		const canvas = canvasRef.current
		const viewportElement = viewportRef.current
		if (!canvas || !viewportElement) return
		let cancelled = false
		let controller: StudioController | undefined
		let resizeFrameId: number | undefined
		const measure = () => createViewport({
			cssWidth: Math.max(1, viewportElement.clientWidth),
			cssHeight: Math.max(1, viewportElement.clientHeight),
			devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
		})
		const handleFailure = (failure: unknown) => {
			setError(failure instanceof Error ? failure.message : 'Runtime failed.')
			if (runtimeKind === 'worker') selectRuntime('main')
		}
		const capability = probeWorkerCanvasSupport(canvas)
		setWorkerCapability(capability)
		if (runtimeKind === 'worker' && (!capability.supported || !supportsWorker(plugin))) {
			selectRuntime('main')
			return
		}
		if (!supportsExecutionProfile(plugin, rendererKind, runtimeKind)) {
			setError(`Experiment '${plugin.id}' does not support the ${rendererKind}/${runtimeKind} profile.`)
			return
		}

		const resizeObserver = new ResizeObserver(() => {
			if (resizeFrameId !== undefined) return
			resizeFrameId = window.requestAnimationFrame(() => {
				resizeFrameId = undefined
				if (controller) void controller.resize(measure()).catch(handleFailure)
			})
		})
		resizeObserver.observe(viewportElement)
		const initialize = async () => {
			const runtimeConfiguration = runtimeConfigurationRef.current
			const options = {
				canvas,
				rendererId: rendererKind,
				viewport: measure(),
				plugin: runtimeConfiguration.plugin,
				parameters: runtimeConfiguration.parameters,
				formulaView: runtimeConfiguration.formulaView,
				seed: runtimeConfiguration.seed,
				startPaused: STAGE_15_BENCHMARK_MODE && runtimeConfiguration.plugin.temporalSemantics.kind !== 'static',
				stage15Benchmark: STAGE_15_BENCHMARK_MODE,
				onMetrics: (nextMetrics: StudioMetrics) => {
					metricsRef.current = nextMetrics
					setMetrics(nextMetrics)
				},
				onFailure: handleFailure,
			}
			controller = runtimeKind === 'worker'
				? await createWorkerStudioController(options)
				: await createMainStudioController(options)
			if (cancelled) { await controller.dispose(); return }
			controllerRef.current = controller
		}

		void initialize().catch((failure: unknown) => {
			setError(failure instanceof Error ? failure.message : 'Unable to initialize runtime.')
			if (runtimeKind === 'worker') selectRuntime('main')
		})
		return () => {
			cancelled = true
			resizeObserver.disconnect()
			if (resizeFrameId !== undefined) window.cancelAnimationFrame(resizeFrameId)
			controllerRef.current = undefined
			void controller?.dispose()
		}
	}, [plugin, rendererKind, runtimeKind, stateGeneration])

	const updateParameter = useCallback((parameterId: string, value: unknown) => {
		const definition = plugin.parameters[parameterId]
		if (!definition) { setError(`Unknown parameter '${parameterId}'.`); return }
		const normalized = plugin.normalizeParameters({ ...parameters, [parameterId]: value })
		if (!normalized.ok) { setError(normalized.error); return }
		const patch = plugin.parseParameterPatch({ [parameterId]: value })
		if (!patch.ok) { setError(patch.error); return }
		setError(undefined)
		setCanWriteUrl(true)
		setParameters(normalized.value)
		runtimeConfigurationRef.current = { plugin, parameters: normalized.value, formulaView, seed }
		const update = controllerRef.current?.updateParameters(patch.value)
		const isFormulaChange = definition.kind === 'string' && definition.control === 'formula'
			|| parameterId === 'formulaMorph'
			|| definition.kind === 'number' && definition.semantic === 'formula-parameter'
		if (paused && frozenSimulationSnapshotId && parameters[parameterId] !== normalized.value[parameterId]) {
			if (isFormulaChange) {
				const label = parameterId === 'formulaMorph'
					? `Morph → ${String(normalized.value[parameterId])}`
					: definition.kind === 'number' && definition.semantic === 'formula-parameter'
						? `${parameterId} → ${String(normalized.value[parameterId])}`
						: `${parameterId.replace(/([A-Z])/g, ' $1')} changed`
				const node = createFormulaPerturbationNode({
					id: `${frozenSimulationSnapshotId}:node-${++formulaHistoryCounterRef.current}`,
					label,
					simulationSnapshotId: frozenSimulationSnapshotId,
					schema: plugin.parameters,
					parameters: normalized.value,
					metrics: historyMetrics(),
				})
				setFormulaHistory((history) => appendFormulaPerturbation(history, node))
			} else {
				const snapshotId = definition.invalidation === 'reset-simulation' ? nextFrozenSnapshotId() : frozenSimulationSnapshotId
				void Promise.resolve(update).then(() => resetFormulaHistory(snapshotId, normalized.value, 'Context changed'))
			}
		}
	}, [formulaView, frozenSimulationSnapshotId, metrics, parameters, paused, plugin, seed, stateGeneration])

	const scheduleStructureAnalysis = async (snapshot: PointCloudSnapshot, epsilon: number) => {
		const runId = ++analysisRunCounterRef.current
		setAnalysisPending(true)
		const scheduler = analysisSchedulerRef.current ?? (analysisSchedulerRef.current = new AnalysisScheduler())
		const worker = analysisWorkerRef.current ?? (analysisWorkerRef.current = new AnalysisWorkerClient())
		try {
			const outcome = await scheduler.schedule({
				snapshotId: snapshot.snapshotId,
				analyzerId: RIPS_COMPLEX_ANALYZER_ID,
				analyzerVersion: RIPS_COMPLEX_ANALYZER_VERSION,
				parameters: { epsilon },
				execute: async (signal) => {
					const value = await worker.analyzeRips(snapshot, epsilon, signal)
					return {
						value,
						sampleCount: snapshot.ids.length,
						inputCount: snapshot.ids.length,
						warnings: value.warnings,
					}
				},
			})
			if (outcome.status === 'completed') setAnalysisResult(outcome.result)
		} catch (failure) {
			if (runId === analysisRunCounterRef.current) {
				setError(failure instanceof Error ? failure.message : 'Point-cloud analysis failed.')
			}
		} finally {
			if (runId === analysisRunCounterRef.current) setAnalysisPending(false)
		}
	}

	const schedulePersistenceAnalysis = async (snapshot: PointCloudSnapshot, epsilonMax: number) => {
		const runId = ++persistenceRunCounterRef.current
		setPersistencePending(true)
		setPersistenceResult(undefined)
		const scheduler = persistenceSchedulerRef.current ?? (persistenceSchedulerRef.current = new AnalysisScheduler())
		const worker = persistenceWorkerRef.current ?? (persistenceWorkerRef.current = new AnalysisWorkerClient())
		try {
			const outcome = await scheduler.schedule({
				snapshotId: snapshot.snapshotId,
				analyzerId: RIPS_PERSISTENCE_ANALYZER_ID,
				analyzerVersion: RIPS_PERSISTENCE_ANALYZER_VERSION,
				parameters: { epsilonMax },
				execute: async (signal) => {
					const value = await worker.analyzePersistence(snapshot, epsilonMax, signal)
					return {
						value,
						sampleCount: snapshot.ids.length,
						inputCount: snapshot.ids.length,
						warnings: value.warnings,
					}
				},
			})
			if (outcome.status === 'completed') setPersistenceResult(outcome.result)
		} catch (failure) {
			if (runId === persistenceRunCounterRef.current) {
				setError(failure instanceof Error ? failure.message : 'Persistent homology analysis failed.')
			}
		} finally {
			if (runId === persistenceRunCounterRef.current) setPersistencePending(false)
		}
	}

	const captureAnalysisSnapshot = async () => {
		const controller = controllerRef.current
		if (!controller) { setError('Runtime is not ready for point-cloud capture.'); return }
		setAnalysisPending(true)
		try {
			const captured = await controller.capturePointCloud({ source: analysisSource })
			if (!isPointCloudSnapshot(captured)) throw new Error('Runtime returned an invalid point-cloud snapshot.')
			setError(undefined)
			setAnalysisSnapshot(captured)
			await Promise.all([
				scheduleStructureAnalysis(captured, analysisEpsilon),
				schedulePersistenceAnalysis(captured, analysisEpsilonMax),
			])
		} catch (failure) {
			setAnalysisPending(false)
			setPersistencePending(false)
			setError(failure instanceof Error ? failure.message : 'Unable to capture analysis snapshot.')
		}
	}

	const updateAnalysisEpsilon = (epsilon: number) => {
		if (!Number.isFinite(epsilon) || epsilon <= 0 || epsilon > analysisEpsilonMax) return
		setAnalysisEpsilon(epsilon)
		setCanWriteUrl(true)
		if (analysisSnapshot) void scheduleStructureAnalysis(analysisSnapshot, epsilon)
	}

	const updateAnalysisEpsilonMax = (epsilonMax: number) => {
		if (!Number.isFinite(epsilonMax) || epsilonMax <= 0) return
		const nextEpsilon = Math.min(analysisEpsilon, epsilonMax)
		setAnalysisEpsilonMax(epsilonMax)
		setAnalysisEpsilon(nextEpsilon)
		setCanWriteUrl(true)
		if (!analysisSnapshot) return
		if (nextEpsilon !== analysisEpsilon) void scheduleStructureAnalysis(analysisSnapshot, nextEpsilon)
		void schedulePersistenceAnalysis(analysisSnapshot, epsilonMax)
	}

	const selectFormulaView = (nextView: StudioFormulaView) => {
		if (!plugin.formulaViews.includes(nextView) || nextView === formulaView) return
		setFormulaView(nextView)
		setCanWriteUrl(true)
		runtimeConfigurationRef.current = { plugin, parameters, formulaView: nextView, seed }
		void controllerRef.current?.updateFormulaView(nextView).catch((failure: unknown) => {
			setError(failure instanceof Error ? failure.message : 'Unable to update formula view.')
		})
	}

	const selectWorkspace = (nextWorkspace: StudioWorkspace) => {
		if (nextWorkspace === 'compare' && plugin.formulaViews.length <= 1) return
		if (nextWorkspace === 'analyze' && plugin.pointCloudSources.length === 0) return
		setWorkspace(nextWorkspace)
		setCanWriteUrl(true)
		if (nextWorkspace === 'explore' && plugin.formulaViews.includes('morph')) selectFormulaView('morph')
		if (nextWorkspace === 'compare' && formulaView === 'morph') {
			selectFormulaView(plugin.formulaViews.includes('compare') ? 'compare' : plugin.formulaViews.find((view) => view !== 'morph') ?? 'morph')
		}
	}

	const dispatchPointer = (phase: StudioPointerEvent['phase'], event: ReactPointerEvent<HTMLCanvasElement>) => {
		const pointerEvent: StudioPointerEvent = {
			phase,
			...pointFor(event),
			buttons: event.buttons,
			shiftKey: event.shiftKey,
		}
		for (const input of interactionRef.current?.handle(pointerEvent) ?? []) void controllerRef.current?.applyInput(input)
	}
	const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (probeEnabled && plugin.formatPointInspection) {
			const point = pointFor(event)
			void controllerRef.current?.inspectPoint({ ...point, maxDistance: 18 }).then((result) => {
				setInspection(plugin.formatPointInspection?.(result))
			}).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Point inspection failed.'))
			return
		}
		dispatchPointer('down', event)
		event.currentTarget.setPointerCapture(event.pointerId)
	}
	const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => dispatchPointer('move', event)
	const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		dispatchPointer('up', event)
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
	}
	const pointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => dispatchPointer('cancel', event)

	const restoreFormulaPerturbation = (node: FormulaPerturbationNode) => {
		if (!paused || !frozenSimulationSnapshotId || node.simulationSnapshotId !== frozenSimulationSnapshotId) {
			setError('That formula perturbation belongs to a simulation state that is no longer frozen.')
			return
		}
		const normalized = plugin.normalizeParameters({ ...parameters, ...node.configuration })
		if (!normalized.ok) { setError(normalized.error); return }
		const patch = plugin.parseParameterPatch(node.configuration)
		if (!patch.ok) { setError(patch.error); return }
		setError(undefined)
		setParameters(normalized.value)
		setCanWriteUrl(true)
		runtimeConfigurationRef.current = { plugin, parameters: normalized.value, formulaView, seed }
		void controllerRef.current?.updateParameters(patch.value).catch((failure: unknown) => {
			setError(failure instanceof Error ? failure.message : 'Unable to restore formula perturbation.')
		})
	}

	const freeze = () => {
		if (paused) return
		const controller = controllerRef.current
		const snapshotId = nextFrozenSnapshotId()
		void (async () => {
			await controller?.pause()
			setPaused(true)
			resetFormulaHistory(snapshotId, runtimeConfigurationRef.current.parameters)
		})().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Unable to freeze simulation.'))
	}
	const run = () => {
		if (!paused) return
		resetFormulaHistory()
		setPaused(false)
		void controllerRef.current?.resume()
	}
	const step = () => {
		if (!paused) return
		const controller = controllerRef.current
		resetFormulaHistory()
		void (async () => {
			await controller?.step()
			resetFormulaHistory(nextFrozenSnapshotId(), runtimeConfigurationRef.current.parameters, 'Stepped frame')
		})().catch((failure: unknown) => setError(failure instanceof Error ? failure.message : 'Unable to step simulation.'))
	}
	const reset = () => {
		const controller = controllerRef.current
		resetFormulaHistory()
		setPaused(false)
		void (async () => {
			await controller?.reset()
			if (paused) await controller?.resume()
		})()
	}

	const copyLink = async () => {
		const artifact = createShareArtifact(new URL(window.location.href), createStudioDurableState(plugin, parameters, seed, runtimeKind, {
			renderer: rendererKind,
			workspace, formulaView, analysis: { source: analysisSource, epsilon: analysisEpsilon, epsilonMax: analysisEpsilonMax },
		}))
		if (artifact.kind === 'json') { setShareStatus(`${artifact.reason} Use Export JSON.`); return }
		await navigator.clipboard.writeText(artifact.url)
		setShareStatus('Reproducible link copied.')
	}

	const exportJson = () => {
		const state = createStudioDurableState(plugin, parameters, seed, runtimeKind, {
			renderer: rendererKind,
			workspace, formulaView, analysis: { source: analysisSource, epsilon: analysisEpsilon, epsilonMax: analysisEpsilonMax },
		})
		const exported = canonicalStringify(createStudioExportDocument(plugin, state))
		const href = URL.createObjectURL(new Blob([exported], { type: 'application/json' }))
		const anchor = document.createElement('a')
		anchor.href = href
		anchor.download = `bindfly-${plugin.id}.json`
		anchor.click()
		URL.revokeObjectURL(href)
		setShareStatus('Canonical JSON exported.')
	}

	const importJson = async (file: File | undefined) => {
		if (!file) return
		const parsed = parseStudioImportDocument(await file.text())
		if (!parsed.ok) { setError(parsed.error); return }
		const resolved = resolveStudioDurableState(parsed.value)
		if (!resolved.ok) { setError(resolved.error); return }
		const nextPlugin = getStudioExperimentPlugin(resolved.value.experimentId)
		if (!nextPlugin) { setError(`Experiment '${resolved.value.experimentId}' is not registered.`); return }
		setError(undefined)
		setPlugin(nextPlugin)
		setParameters(resolved.value.parameters)
		setSeed(resolved.value.seed)
		setRendererKind(resolved.value.studio.renderer)
		runtimeConfigurationRef.current = {
			plugin: nextPlugin,
			parameters: resolved.value.parameters,
			formulaView: resolved.value.studio.formulaView,
			seed: resolved.value.seed,
		}
		setRuntimeKind(resolved.value.runtime)
		setWorkspace(resolved.value.studio.workspace)
		setFormulaView(resolved.value.studio.formulaView)
		setAnalysisSource(resolved.value.studio.analysis.source)
		setAnalysisEpsilon(resolved.value.studio.analysis.epsilon)
		setAnalysisEpsilonMax(resolved.value.studio.analysis.epsilonMax)
		setStateGeneration((generation) => generation + 1)
		metricsRef.current = EMPTY_METRICS
		setMetrics(EMPTY_METRICS)
		setPaused(false)
		setFormulaHistory([])
		setFrozenSimulationSnapshotId(undefined)
		clearPinnedAnalysis()
		setCanWriteUrl(true)
		setShareStatus('Canonical JSON imported.')
	}

	const persistenceAtCursor = persistenceResult?.value.status === 'computed'
		? {
			beta0: countPersistenceIntervalsAt(persistenceResult.value.h0, analysisEpsilon),
			beta1: countPersistenceIntervalsAt(persistenceResult.value.h1, analysisEpsilon),
		}
		: undefined
	const epsilonMaxOptions = PERSISTENCE_EPSILON_MAX_OPTIONS.includes(analysisEpsilonMax as typeof PERSISTENCE_EPSILON_MAX_OPTIONS[number])
		? PERSISTENCE_EPSILON_MAX_OPTIONS
		: [analysisEpsilonMax, ...PERSISTENCE_EPSILON_MAX_OPTIONS].sort((left, right) => left - right)

	return <main className="studio">
		<aside className="panel" aria-label="Experiment controls">
			<header><div><p className="eyebrow">Bindfly 2 · Stage 15</p><h1>{plugin.title}</h1></div><p className="description">Versioned, reproducible experiment state.</p></header>
			<label className="picker"><span>Experiment</span><select value={plugin.id} aria-label="Experiment" onChange={(event) => selectExperiment(event.currentTarget.value)}>{EXPERIMENTS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
			<nav className="workspace-tabs" aria-label="Studio workspace">
				<button type="button" aria-pressed={workspace === 'explore'} onClick={() => selectWorkspace('explore')}>Explore</button>
				<button type="button" aria-pressed={workspace === 'compare'} disabled={plugin.formulaViews.length <= 1} onClick={() => selectWorkspace('compare')}>Compare</button>
				<button type="button" aria-pressed={workspace === 'analyze'} disabled={plugin.pointCloudSources.length === 0} onClick={() => selectWorkspace('analyze')}>Analyze</button>
			</nav>
			{workspace === 'compare' ? <div className="lens-tabs" role="group" aria-label="Formula lens">{plugin.formulaViews.filter((view) => view !== 'morph').map((view) => <button type="button" key={view} aria-pressed={formulaView === view} onClick={() => selectFormulaView(view)}>{FORMULA_VIEW_LABELS[view]}</button>)}</div> : null}
			{workspace !== 'analyze' ? <ParameterControls schema={plugin.parameters} values={parameters} onChange={updateParameter} /> : null}
			<div className="picker-grid">
				<label className="picker"><span>Renderer</span><select value={rendererKind} aria-label="Renderer" onChange={(event) => selectRenderer(event.currentTarget.value as RendererKind)}><option value="canvas2d">Canvas 2D</option><option value="webgl2" disabled={!supportsExecutionProfile(plugin, 'webgl2', 'main')}>WebGL 2</option></select></label>
				<label className="picker"><span>Runtime</span><select value={runtimeKind} aria-label="Runtime" onChange={(event) => selectRuntime(event.currentTarget.value as StudioRuntimeKind)}><option value="main">Main thread</option><option value="worker" disabled={!workerCapability.supported || !supportsWorker(plugin)}>Worker</option></select></label>
			</div>
			{plugin.temporalSemantics.kind !== 'static' ? <div className="actions"><button type="button" disabled={!paused} onClick={run}>Run</button><button type="button" disabled={paused} onClick={freeze}>Freeze</button><button type="button" disabled={!paused} onClick={step}>{plugin.temporalSemantics.stepLabel ?? 'Step'}</button><button type="button" onClick={reset}>Reset</button></div> : null}
			{workspace !== 'analyze' && plugin.formatPointInspection ? <div className="probe-actions"><button type="button" aria-pressed={probeEnabled} onClick={() => { setProbeEnabled((enabled) => !enabled); setInspection(undefined) }}>{probeEnabled ? 'Probe on · click a point' : 'Probe point'}</button>{inspection ? <button type="button" onClick={() => setInspection(undefined)}>Clear probe</button> : null}</div> : null}
			{inspection ? <section className="probe-panel" aria-label="Point probe"><h2>{inspection.title}</h2>{inspection.sections.map((section) => <details key={section.title} open={!section.title.startsWith('Trace')}><summary>{section.title}</summary><dl>{section.rows.map((row, index) => <div key={`${row.label}-${index}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details>)}</section> : null}
			{workspace !== 'analyze' && formulaHistory.length > 0 ? <section className="formula-history" aria-labelledby="formula-history-heading">
				<div className="formula-history-heading"><div><h2 id="formula-history-heading">Formula trail</h2><p>Recent perturbations of this frozen simulation state.</p></div><span>{formulaHistory.length}</span></div>
				<ol>{formulaHistory.map((node) => <li key={node.id}><button type="button" onClick={() => restoreFormulaPerturbation(node)}><strong>{node.label}</strong><span>step {node.metrics.step} · {node.metrics.points} points · {node.metrics.edges} edges</span></button></li>)}</ol>
				<p className="analysis-note">Snapshot {formulaHistory[0]?.simulationSnapshotId}</p>
			</section> : null}
			{workspace === 'analyze' && plugin.pointCloudSources.length > 0 ? <section className="analysis-panel" aria-labelledby="structure-heading">
				<div className="analysis-heading"><div><h2 id="structure-heading">Structure</h2><p>Pin geometry, then vary analysis ε without changing the experiment.</p></div><span>{analysisPending || persistencePending ? 'Analyzing…' : analysisSnapshot ? 'Pinned' : 'Live'}</span></div>
				<div className="analysis-capture">
					<label className="picker"><span>Snapshot source</span><select value={analysisSource} aria-label="Analysis snapshot source" onChange={(event) => setAnalysisSource(event.currentTarget.value as PointCloudSnapshotSource)}>{plugin.pointCloudSources.map((source) => <option key={source} value={source}>{pointCloudSourceLabel(source)}</option>)}</select></label>
					<button type="button" disabled={analysisPending} onClick={() => { void captureAnalysisSnapshot() }}>{analysisSnapshot ? 'Analyze this frame again' : 'Analyze this frame'}</button>
				</div>
				<div className="analysis-scale-controls">
					<label className="analysis-epsilon"><span>Analysis ε <output>{analysisEpsilon.toFixed(0)} px</output></span><input type="range" min="1" max={analysisEpsilonMax} step="1" value={analysisEpsilon} disabled={!analysisSnapshot} onChange={(event) => updateAnalysisEpsilon(Number(event.currentTarget.value))} /></label>
					<label className="picker"><span>Persistence εmax</span><select value={analysisEpsilonMax} aria-label="Persistence epsilon maximum" onChange={(event) => updateAnalysisEpsilonMax(Number(event.currentTarget.value))}>{epsilonMaxOptions.map((epsilonMax) => <option key={epsilonMax} value={epsilonMax}>{epsilonMax} px</option>)}</select></label>
				</div>
				{analysisSnapshot ? <p className="analysis-snapshot">Pinned {pointCloudSourceLabel(analysisSnapshot.source)} · step {analysisSnapshot.simulationStep} · {analysisSnapshot.ids.length} points</p> : <p className="analysis-snapshot">No point-cloud snapshot pinned.</p>}
				{analysisResult ? <>
					<dl className="structure-metrics">
						<div><dt>Points</dt><dd>{analysisResult.value.pointCount}</dd></div>
						<div><dt>Edges</dt><dd>{analysisResult.value.edgeCount}</dd></div>
						<div><dt>Components β₀</dt><dd>{analysisResult.value.beta0}</dd></div>
						<div><dt>Mean degree</dt><dd>{analysisResult.value.meanDegree.toFixed(2)}</dd></div>
						<div><dt>Isolated points</dt><dd>{analysisResult.value.isolatedPointCount}</dd></div>
						<div><dt>Graph cycle rank</dt><dd>{analysisResult.value.graphCycleRank}</dd></div>
						<div><dt>Rips triangles</dt><dd>{analysisResult.value.triangleCount}</dd></div>
						<div><dt>Topological β₁</dt><dd>{analysisResult.value.beta1Status === 'computed' ? analysisResult.value.beta1 : 'budget'}</dd></div>
						<div><dt>ε</dt><dd>{analysisResult.value.epsilon.toFixed(0)} px</dd></div>
					</dl>
					<p className="analysis-note">Graph cycle rank is E − V + β₀. β₁ is computed over the filled Rips 2-complex over F₂ and is withheld when its triangle budget is exceeded.</p>
					{persistenceResult ? <section className="persistence-section" aria-labelledby="persistence-heading">
						<div className="persistence-heading"><div><h3 id="persistence-heading">Persistence</h3><p>Computed once for this pinned point cloud through εmax. Moving ε only queries the intervals.</p></div><span>{persistenceResult.value.status === 'computed' ? `${persistenceResult.value.simplexCount} simplices` : 'budget'}</span></div>
						{persistenceResult.value.status === 'computed' && persistenceAtCursor ? <>
							<dl className="structure-metrics persistence-metrics">
								<div><dt>Persistent β₀ at ε</dt><dd>{persistenceAtCursor.beta0}</dd></div>
								<div><dt>Persistent β₁ at ε</dt><dd>{persistenceAtCursor.beta1}</dd></div>
								<div><dt>H₀ intervals</dt><dd>{persistenceResult.value.h0.length}</dd></div>
								<div><dt>H₁ intervals</dt><dd>{persistenceResult.value.h1.length}</dd></div>
							</dl>
							<PersistenceViews result={persistenceResult.value} epsilon={analysisEpsilon} />
							<p className="analysis-note">Intervals use [birth, death). An open interval at the right edge means the class is still alive at εmax; it is not claimed to persist forever.</p>
						</> : <p className="analysis-warning">{persistenceResult.warnings.join(' · ') || 'Persistent homology exceeded its analysis budget.'}</p>}
						<dl className="analysis-provenance">
							<div><dt>Analyzer</dt><dd>{persistenceResult.analyzerId} v{persistenceResult.analyzerVersion}</dd></div>
							<div><dt>Backend</dt><dd>{persistenceResult.value.backend.id} v{persistenceResult.value.backend.version} · {persistenceResult.value.backend.sourceCommit.slice(0, 8)}</dd></div>
							<div><dt>Computation</dt><dd>{persistenceResult.value.backend.numericSemantics}</dd></div>
							<div><dt>εmax</dt><dd>{persistenceResult.value.epsilonMax.toFixed(0)} px</dd></div>
							<div><dt>Duration</dt><dd>{persistenceResult.durationMs.toFixed(1)} ms</dd></div>
						</dl>
					</section> : persistencePending ? <p className="analysis-note">Computing persistence through εmax…</p> : null}
					<dl className="analysis-provenance">
						<div><dt>Metric</dt><dd>Euclidean · CSS px</dd></div>
						<div><dt>Snapshot</dt><dd>{analysisResult.snapshotId}</dd></div>
						<div><dt>Analyzer</dt><dd>{analysisResult.analyzerId} v{analysisResult.analyzerVersion}</dd></div>
						<div><dt>Sample</dt><dd>{analysisResult.sampleCount === analysisResult.inputCount ? `All ${analysisResult.inputCount} points` : `${analysisResult.sampleCount} of ${analysisResult.inputCount} points`}</dd></div>
						<div><dt>Duration</dt><dd>{analysisResult.durationMs.toFixed(1)} ms</dd></div>
					</dl>
					{analysisResult.warnings.length > 0 ? <p className="analysis-warning">{analysisResult.warnings.join(' · ')}</p> : null}
				</> : null}
			</section> : null}
			<div className="state-actions"><button type="button" onClick={() => { void copyLink() }}>Copy link</button><button type="button" onClick={exportJson}>Export JSON</button><label className="file-button" htmlFor="state-import">Import JSON<input id="state-import" type="file" accept="application/json,.json" onChange={(event) => { void importJson(event.currentTarget.files?.[0]) }} /></label></div>
			<p className="share-status" role="status">{shareStatus}</p>
			{error ? <p className="error-message" role="alert">{error}</p> : null}
			<section aria-labelledby="performance-heading"><h2 id="performance-heading">Performance</h2><dl className="metrics">
				{plugin.metrics.map((descriptor) => {
					const value = metrics[descriptor.id as keyof Omit<StudioMetrics, 'stage15Parity'>] ?? 0
					return <div className="metric" data-metric-id={descriptor.id} data-metric-value={String(value)} key={descriptor.id}><dt>{descriptor.label}</dt><dd>{descriptor.format ? descriptor.format(value) : String(value)}</dd></div>
				})}
			</dl></section>
			<details className="inspector"><summary>Inspector</summary><dl><div><dt>Experiment</dt><dd>{plugin.id} v{plugin.stateVersion}</dd></div><div><dt>Renderer</dt><dd>{rendererKind} · {runtimeKind}</dd></div><div><dt>Timing</dt><dd>{plugin.temporalSemantics.kind === 'static' ? 'Static field' : `${Math.round(1 / plugin.timing.fixedStepSeconds)} Hz · ${plugin.timing.deterministicTier}`}</dd></div><div><dt>Derivation</dt><dd>{plugin.temporalSemantics.kind === 'static' ? `${metrics.searchBackend} · ${metrics.points} samples` : `${metrics.searchBackend} · step ${metrics.step} · ${metrics.points} samples`}</dd></div><div><dt>Worker capability</dt><dd>{workerCapability.supported && supportsWorker(plugin) ? 'Supported by this experiment and browser.' : workerCapability.reason ?? 'Unavailable for this experiment.'}</dd></div></dl>{plugin.provenance.length > 0 ? <section className="provenance" aria-labelledby="provenance-heading"><h2 id="provenance-heading">Formula provenance</h2>{plugin.provenance.map((entry) => <article key={entry.id}><strong>{entry.id} · v{entry.version}</strong><span>{entry.capturedBehavior}</span><code>{entry.legacyPath}</code><code>{entry.legacyGitBlob}</code></article>)}</section> : null}</details>
		</aside>
		<section className="viewport" ref={viewportRef}>
			<canvas className={workspace === 'analyze' && analysisSnapshot && analysisResult ? 'simulation-canvas simulation-canvas--analysis-hidden' : 'simulation-canvas'} key={`${plugin.id}-${rendererKind}-${runtimeKind}-${stateGeneration}`} ref={canvasRef} tabIndex={0} aria-label={`Interactive ${plugin.title} simulation`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} />
			{STAGE_15_BENCHMARK_MODE && metrics.stage15Parity ? <output
				hidden
				data-stage15-simulation-checksum={metrics.stage15Parity.simulationChecksum}
				data-stage15-render-view-checksum={metrics.stage15Parity.renderViewChecksum}
				data-stage15-post-render-simulation-checksum={metrics.stage15Parity.postRenderSimulationChecksum}
				data-stage15-post-render-view-checksum={metrics.stage15Parity.postRenderViewChecksum}
				data-stage15-parity="true"
			/> : null}
			{workspace === 'analyze' && analysisSnapshot && analysisResult ? <canvas ref={analysisCanvasRef} className="analysis-canvas" aria-label={`Pinned ${pointCloudSourceLabel(analysisSnapshot.source)} Rips complex at step ${analysisSnapshot.simulationStep}`} /> : null}
			<div className="badge">{workspace === 'analyze' && analysisSnapshot ? `pinned · step ${analysisSnapshot.simulationStep} · ε ${analysisEpsilon.toFixed(0)} px` : `seed · ${seed} · derivation ${metrics.searchBackend} · ${rendererKind} · ${runtimeKind}`}</div>
		</section>
	</main>
}
