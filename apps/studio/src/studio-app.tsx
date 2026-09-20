import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { createViewport } from '../../../src-v2/core/viewport.ts'
import { probeWorkerCanvasSupport } from '../../../src-v2/runtime/worker-runtime.ts'
import type { WorkerCanvasCapability } from '../../../src-v2/runtime/worker-runtime.ts'
import { ParameterControls } from './parameter-controls.tsx'
import { createMainStudioController, createWorkerStudioController } from './studio-controller.ts'
import type { StudioController, StudioMetrics, StudioRuntimeKind } from './studio-controller.ts'
import { DEFAULT_STUDIO_EXPERIMENT_ID, getStudioExperimentPlugin, listStudioExperimentPlugins } from './studio-experiment-registry.ts'
import type { StudioExperimentPlugin, StudioParameterValues, StudioPointerEvent } from './studio-experiment-plugin.ts'
import { canonicalStringify, createShareArtifact, createStudioDurableState, createStudioExportDocument, parseStudioImportDocument, readStudioStateFromUrl, resolveStudioDurableState } from './studio-state.ts'

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
const INITIAL_PARAMETERS = INITIAL_RESOLVED_STATE?.parameters ?? INITIAL_PLUGIN.defaultParameters
const INITIAL_SEED = INITIAL_RESOLVED_STATE?.seed ?? INITIAL_PLUGIN.defaultSeed
const INITIAL_ERROR = INITIAL_URL_STATE.ok ? undefined : INITIAL_URL_STATE.error

const pointFor = (event: ReactPointerEvent<HTMLCanvasElement>) => {
	const bounds = event.currentTarget.getBoundingClientRect()
	return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

const supportsWorker = (plugin: StudioExperimentPlugin) => plugin.executionProfiles.some(
	({ rendererId, runtimeId }) => rendererId === 'canvas2d' && runtimeId === 'worker',
)

export const StudioApp = () => {
	const [plugin, setPlugin] = useState(INITIAL_PLUGIN)
	const [parameters, setParameters] = useState<StudioParameterValues>(INITIAL_PARAMETERS)
	const [seed, setSeed] = useState(INITIAL_SEED)
	const [runtimeKind, setRuntimeKind] = useState<StudioRuntimeKind>(INITIAL_RUNTIME)
	const [workerCapability, setWorkerCapability] = useState<WorkerCanvasCapability>({ supported: false, reason: 'Checking browser capability.' })
	const [metrics, setMetrics] = useState<StudioMetrics>(EMPTY_METRICS)
	const [paused, setPaused] = useState(false)
	const [error, setError] = useState<string | undefined>(INITIAL_ERROR)
	const [shareStatus, setShareStatus] = useState(INITIAL_RESOLVED_STATE?.migratedFrom ? 'Legacy preset migrated.' : '')
	const [stateGeneration, setStateGeneration] = useState(0)
	const [canWriteUrl, setCanWriteUrl] = useState(INITIAL_URL_STATE.ok)
	const runtimeConfigurationRef = useRef({ plugin: INITIAL_PLUGIN, parameters: INITIAL_PARAMETERS, seed: INITIAL_SEED })
	const interactionRef = useRef<ReturnType<StudioExperimentPlugin['createInteractionController']> | null>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const viewportRef = useRef<HTMLElement>(null)
	const controllerRef = useRef<StudioController>()

	const selectRuntime = (runtime: StudioRuntimeKind) => {
		setPaused(false)
		setMetrics(EMPTY_METRICS)
		setRuntimeKind(runtime)
		setCanWriteUrl(true)
	}

	const selectExperiment = (experimentId: string) => {
		const nextPlugin = getStudioExperimentPlugin(experimentId)
		if (!nextPlugin) { setError(`Experiment '${experimentId}' is not registered.`); return }
		const nextRuntime = runtimeKind === 'worker' && supportsWorker(nextPlugin) ? 'worker' : 'main'
		setPlugin(nextPlugin)
		setParameters(nextPlugin.defaultParameters)
		setSeed(nextPlugin.defaultSeed)
		setRuntimeKind(nextRuntime)
		setMetrics(EMPTY_METRICS)
		setPaused(false)
		setError(undefined)
		setCanWriteUrl(true)
		setStateGeneration((generation) => generation + 1)
		runtimeConfigurationRef.current = {
			plugin: nextPlugin, parameters: nextPlugin.defaultParameters, seed: nextPlugin.defaultSeed,
		}
	}

	useEffect(() => {
		interactionRef.current = plugin.createInteractionController()
	}, [plugin])

	useEffect(() => {
		if (!canWriteUrl) return
		const artifact = createShareArtifact(
			new URL(window.location.href),
			createStudioDurableState(plugin, parameters, seed, runtimeKind),
		)
		if (artifact.kind === 'url') window.history.replaceState(null, '', artifact.url)
	}, [canWriteUrl, parameters, plugin, runtimeKind, seed])

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
				viewport: measure(),
				plugin: runtimeConfiguration.plugin,
				parameters: runtimeConfiguration.parameters,
				seed: runtimeConfiguration.seed,
				onMetrics: setMetrics,
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
	}, [plugin, runtimeKind, stateGeneration])

	const updateParameter = useCallback((parameterId: string, value: unknown) => {
		const normalized = plugin.normalizeParameters({ ...parameters, [parameterId]: value })
		if (!normalized.ok) { setError(normalized.error); return }
		const patch = plugin.parseParameterPatch({ [parameterId]: value })
		if (!patch.ok) { setError(patch.error); return }
		setError(undefined)
		setCanWriteUrl(true)
		setParameters(normalized.value)
		runtimeConfigurationRef.current = { plugin, parameters: normalized.value, seed }
		void controllerRef.current?.updateParameters(patch.value)
	}, [parameters, plugin, seed])

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
		dispatchPointer('down', event)
		event.currentTarget.setPointerCapture(event.pointerId)
	}
	const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => dispatchPointer('move', event)
	const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		dispatchPointer('up', event)
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
	}
	const pointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => dispatchPointer('cancel', event)

	const togglePause = () => {
		const nextPaused = !paused
		setPaused(nextPaused)
		void (nextPaused ? controllerRef.current?.pause() : controllerRef.current?.resume())
	}

	const copyLink = async () => {
		const artifact = createShareArtifact(new URL(window.location.href), createStudioDurableState(plugin, parameters, seed, runtimeKind))
		if (artifact.kind === 'json') { setShareStatus(`${artifact.reason} Use Export JSON.`); return }
		await navigator.clipboard.writeText(artifact.url)
		setShareStatus('Reproducible link copied.')
	}

	const exportJson = () => {
		const state = createStudioDurableState(plugin, parameters, seed, runtimeKind)
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
		runtimeConfigurationRef.current = { plugin: nextPlugin, parameters: resolved.value.parameters, seed: resolved.value.seed }
		setRuntimeKind(resolved.value.runtime)
		setStateGeneration((generation) => generation + 1)
		setMetrics(EMPTY_METRICS)
		setPaused(false)
		setCanWriteUrl(true)
		setShareStatus('Canonical JSON imported.')
	}

	return <main className="studio">
		<aside className="panel" aria-label="Experiment controls">
			<header><div><p className="eyebrow">Bindfly 2 · Stage 12</p><h1>{plugin.title}</h1></div><p className="description">Versioned, reproducible experiment state.</p></header>
			<label className="picker"><span>Experiment</span><select value={plugin.id} aria-label="Experiment" onChange={(event) => selectExperiment(event.currentTarget.value)}>{EXPERIMENTS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
			<ParameterControls schema={plugin.parameters} values={parameters} onChange={updateParameter} />
			<div className="picker-grid">
				<label className="picker"><span>Renderer</span><select value="canvas2d" aria-label="Renderer" disabled onChange={() => {}}><option value="canvas2d">Canvas 2D</option></select></label>
				<label className="picker"><span>Runtime</span><select value={runtimeKind} aria-label="Runtime" onChange={(event) => selectRuntime(event.currentTarget.value as StudioRuntimeKind)}><option value="main">Main thread</option><option value="worker" disabled={!workerCapability.supported || !supportsWorker(plugin)}>Worker</option></select></label>
			</div>
			<div className="actions"><button type="button" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button><button type="button" onClick={() => { setPaused(false); void controllerRef.current?.reset() }}>Reset</button></div>
			<div className="state-actions"><button type="button" onClick={() => { void copyLink() }}>Copy link</button><button type="button" onClick={exportJson}>Export JSON</button><label className="file-button" htmlFor="state-import">Import JSON<input id="state-import" type="file" accept="application/json,.json" onChange={(event) => { void importJson(event.currentTarget.files?.[0]) }} /></label></div>
			<p className="share-status" role="status">{shareStatus}</p>
			{error ? <p className="error-message" role="alert">{error}</p> : null}
			<section aria-labelledby="performance-heading"><h2 id="performance-heading">Performance</h2><dl className="metrics">
				{plugin.metrics.map((descriptor) => {
					const value = metrics[descriptor.id as keyof StudioMetrics]
					return <div className="metric" key={descriptor.id}><dt>{descriptor.label}</dt><dd>{descriptor.format ? descriptor.format(value) : String(value)}</dd></div>
				})}
			</dl></section>
			<details className="inspector"><summary>Inspector</summary><dl><div><dt>Experiment</dt><dd>{plugin.id} v{plugin.stateVersion}</dd></div><div><dt>Timing</dt><dd>{Math.round(1 / plugin.timing.fixedStepSeconds)} Hz · {plugin.timing.deterministicTier}</dd></div><div><dt>Derivation</dt><dd>{metrics.searchBackend} · step {metrics.step} · {metrics.points} samples</dd></div><div><dt>Worker capability</dt><dd>{workerCapability.supported && supportsWorker(plugin) ? 'Supported by this experiment and browser.' : workerCapability.reason ?? 'Unavailable for this experiment.'}</dd></div></dl>{plugin.provenance.length > 0 ? <section className="provenance" aria-labelledby="provenance-heading"><h2 id="provenance-heading">Formula provenance</h2>{plugin.provenance.map((entry) => <article key={entry.id}><strong>{entry.id} · v{entry.version}</strong><span>{entry.capturedBehavior}</span><code>{entry.legacyPath}</code><code>{entry.legacyGitBlob}</code></article>)}</section> : null}</details>
		</aside>
		<section className="viewport" ref={viewportRef}><canvas key={`${plugin.id}-${runtimeKind}-${stateGeneration}`} ref={canvasRef} tabIndex={0} aria-label={`Interactive ${plugin.title} simulation`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} /><div className="badge">seed · {seed} · derivation {metrics.searchBackend} · {runtimeKind}</div></section>
	</main>
}
