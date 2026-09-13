import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

import { normalizeParameters } from '../../../src-v2/core/parameters.ts'
import type { ParameterValues } from '../../../src-v2/core/parameters.ts'
import { createViewport } from '../../../src-v2/core/viewport.ts'
import { flyingLinesDefinition } from '../../../src-v2/effects/flying-lines/definition.ts'
import { flyingLinesParameters } from '../../../src-v2/effects/flying-lines/parameters.ts'
import { experimentRegistry } from '../../../src-v2/effects/registry.ts'
import { probeWorkerCanvasSupport } from '../../../src-v2/runtime/worker-runtime.ts'
import type { WorkerCanvasCapability } from '../../../src-v2/runtime/worker-runtime.ts'
import { ParameterControls } from './parameter-controls.tsx'
import { createMainStudioController, createWorkerStudioController } from './studio-controller.ts'
import type { StudioController, StudioMetrics, StudioRuntimeKind } from './studio-controller.ts'
import { createShareArtifact, createStudioDurableState, parseStudioDurableState, readStudioStateFromUrl, resolveStudioDurableState } from './studio-state.ts'

const SEED = 'bindfly-flying-lines-simple-v1'
const EMPTY_METRICS: StudioMetrics = { points: 0, edges: 0, components: 0, step: 0, frameMs: 0, droppedSteps: 0, searchBackend: 'brute' }
const DEFAULT_PARAMETERS_RESULT = normalizeParameters(flyingLinesParameters, {})
if (!DEFAULT_PARAMETERS_RESULT.ok) throw new Error('Flying Lines defaults are invalid.')
const DEFAULT_PARAMETERS = DEFAULT_PARAMETERS_RESULT.value
const EXPERIMENT_IDS = experimentRegistry.list()
const INITIAL_URL_STATE = readStudioStateFromUrl(new URL(window.location.href))
const INITIAL_RESOLVED_STATE = INITIAL_URL_STATE.ok ? INITIAL_URL_STATE.value : undefined
const INITIAL_RUNTIME: StudioRuntimeKind = INITIAL_RESOLVED_STATE?.runtime
	?? (new URL(window.location.href).searchParams.get('runtime') === 'worker' ? 'worker' : 'main')
const INITIAL_PARAMETERS = INITIAL_RESOLVED_STATE?.parameters ?? DEFAULT_PARAMETERS
const INITIAL_SEED = INITIAL_RESOLVED_STATE?.seed ?? SEED
const INITIAL_ERROR = INITIAL_URL_STATE.ok ? undefined : INITIAL_URL_STATE.error

const pointFor = (event: ReactPointerEvent<HTMLCanvasElement>) => {
	const bounds = event.currentTarget.getBoundingClientRect()
	return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

export const StudioApp = () => {
	const [parameters, setParameters] = useState<ParameterValues<typeof flyingLinesParameters>>(INITIAL_PARAMETERS)
	const [seed, setSeed] = useState(INITIAL_SEED)
	const [runtimeKind, setRuntimeKind] = useState<StudioRuntimeKind>(INITIAL_RUNTIME)
	const [workerCapability, setWorkerCapability] = useState<WorkerCanvasCapability>({ supported: false, reason: 'Checking browser capability.' })
	const [metrics, setMetrics] = useState<StudioMetrics>(EMPTY_METRICS)
	const [paused, setPaused] = useState(false)
	const [error, setError] = useState<string | undefined>(INITIAL_ERROR)
	const [shareStatus, setShareStatus] = useState(INITIAL_RESOLVED_STATE?.migratedFrom ? 'Legacy preset migrated.' : '')
	const [stateGeneration, setStateGeneration] = useState(0)
	const [canWriteUrl, setCanWriteUrl] = useState(INITIAL_URL_STATE.ok)
	const runtimeConfigurationRef = useRef({ parameters: INITIAL_PARAMETERS, seed: INITIAL_SEED })
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const viewportRef = useRef<HTMLElement>(null)
	const controllerRef = useRef<StudioController>()
	const dragPointRef = useRef<{ x: number; y: number }>()
	const dragMovedRef = useRef(false)
	const selectRuntime = (runtime: StudioRuntimeKind) => {
		setPaused(false)
		setMetrics(EMPTY_METRICS)
		setRuntimeKind(runtime)
		setCanWriteUrl(true)
	}

	useEffect(() => {
		if (!canWriteUrl) return
		const artifact = createShareArtifact(
			new URL(window.location.href),
			createStudioDurableState(parameters, seed, runtimeKind),
		)
		if (artifact.kind === 'url') window.history.replaceState(null, '', artifact.url)
	}, [canWriteUrl, parameters, runtimeKind, seed])

	useEffect(() => {
		const canvas = canvasRef.current
		const viewportElement = viewportRef.current
		if (!canvas || !viewportElement) return
		let cancelled = false
		let controller: StudioController | undefined
		const measure = () => createViewport({
			cssWidth: Math.max(1, viewportElement.clientWidth),
			cssHeight: Math.max(1, viewportElement.clientHeight),
			devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
		})
		const capability = probeWorkerCanvasSupport(canvas)
		setWorkerCapability(capability)
		if (runtimeKind === 'worker' && !capability.supported) {
			selectRuntime('main')
			return
		}

		const resizeObserver = new ResizeObserver(() => {
			if (controller) void controller.resize(measure())
		})
		resizeObserver.observe(viewportElement)
		const initialize = async () => {
			const runtimeConfiguration = runtimeConfigurationRef.current
			const options = {
				canvas,
				viewport: measure(),
				parameters: runtimeConfiguration.parameters,
				seed: runtimeConfiguration.seed,
				onMetrics: setMetrics,
				onFailure: (failure: unknown) => {
					setError(failure instanceof Error ? failure.message : 'Runtime failed.')
					if (runtimeKind === 'worker') selectRuntime('main')
				},
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
			controllerRef.current = undefined
			void controller?.dispose()
		}
	}, [runtimeKind, stateGeneration])

	const updateParameter = useCallback((parameterId: keyof typeof flyingLinesParameters, value: unknown) => {
		const normalized = normalizeParameters(flyingLinesParameters, { ...parameters, [parameterId]: value })
		if (!normalized.ok) { setError(normalized.issues[0]?.message ?? 'Invalid parameter.'); return }
		setError(undefined)
		setCanWriteUrl(true)
		setParameters(normalized.value)
		runtimeConfigurationRef.current = { parameters: normalized.value, seed }
		void controllerRef.current?.updateParameters({ [parameterId]: value })
	}, [parameters, seed])
	const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const point = pointFor(event)
		if (event.shiftKey) { void controllerRef.current?.applyInput({ type: 'remove-nearest', ...point, maxDistance: 18 }); return }
		dragPointRef.current = point
		dragMovedRef.current = false
		event.currentTarget.setPointerCapture(event.pointerId)
	}
	const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		const previous = dragPointRef.current
		if (!previous || event.buttons === 0) return
		const point = pointFor(event)
		if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) dragMovedRef.current = true
		void controllerRef.current?.applyInput({ type: 'move-nearest', fromX: previous.x, fromY: previous.y, ...point, maxDistance: 14 })
		dragPointRef.current = point
	}
	const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
		if (dragPointRef.current && !dragMovedRef.current) void controllerRef.current?.applyInput({ type: 'add-point', ...pointFor(event) })
		dragPointRef.current = undefined
		if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
	}

	const togglePause = () => {
		const nextPaused = !paused
		setPaused(nextPaused)
		void (nextPaused ? controllerRef.current?.pause() : controllerRef.current?.resume())
	}

	const copyLink = async () => {
		const artifact = createShareArtifact(new URL(window.location.href), createStudioDurableState(parameters, seed, runtimeKind))
		if (artifact.kind === 'json') { setShareStatus(`${artifact.reason} Use Export JSON.`); return }
		await navigator.clipboard.writeText(artifact.url)
		setShareStatus('Reproducible link copied.')
	}

	const exportJson = () => {
		const state = createStudioDurableState(parameters, seed, runtimeKind)
		const artifact = createShareArtifact(new URL(window.location.href), state, 0)
		if (artifact.kind !== 'json') return
		const href = URL.createObjectURL(new Blob([artifact.json], { type: 'application/json' }))
		const anchor = document.createElement('a')
		anchor.href = href
		anchor.download = 'bindfly-flying-lines.json'
		anchor.click()
		URL.revokeObjectURL(href)
		setShareStatus('Canonical JSON exported.')
	}

	const importJson = async (file: File | undefined) => {
		if (!file) return
		const parsed = parseStudioDurableState(await file.text())
		if (!parsed.ok) { setError(parsed.error); return }
		const resolved = resolveStudioDurableState(parsed.value)
		if (!resolved.ok) { setError(resolved.error); return }
		setError(undefined)
		setParameters(resolved.value.parameters)
		setSeed(resolved.value.seed)
		runtimeConfigurationRef.current = { parameters: resolved.value.parameters, seed: resolved.value.seed }
		setRuntimeKind(resolved.value.runtime)
		setStateGeneration((generation) => generation + 1)
		setMetrics(EMPTY_METRICS)
		setPaused(false)
		setCanWriteUrl(true)
		setShareStatus('Canonical JSON imported.')
	}

	return <main className="studio">
		<aside className="panel" aria-label="Experiment controls">
			<header><div><p className="eyebrow">Bindfly 2 · Phase 9</p><h1>Flying Lines</h1></div><p className="description">Versioned, reproducible experiment state.</p></header>
			<label className="picker"><span>Experiment</span><select value="flying-lines" aria-label="Experiment" onChange={() => {}}>{EXPERIMENT_IDS.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
			<ParameterControls schema={flyingLinesParameters} values={parameters} onChange={updateParameter} />
			<div className="picker-grid">
				<label className="picker"><span>Renderer</span><select value="canvas2d" aria-label="Renderer" disabled onChange={() => {}}><option value="canvas2d">Canvas 2D</option></select></label>
				<label className="picker"><span>Runtime</span><select value={runtimeKind} aria-label="Runtime" onChange={(event) => selectRuntime(event.currentTarget.value as StudioRuntimeKind)}><option value="main">Main thread</option><option value="worker" disabled={!workerCapability.supported}>Worker</option></select></label>
			</div>
			<div className="actions"><button type="button" onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button><button type="button" onClick={() => { setPaused(false); void controllerRef.current?.reset() }}>Reset</button></div>
			<div className="state-actions"><button type="button" onClick={() => { void copyLink() }}>Copy link</button><button type="button" onClick={exportJson}>Export JSON</button><label className="file-button" htmlFor="state-import">Import JSON<input id="state-import" type="file" accept="application/json,.json" onChange={(event) => { void importJson(event.currentTarget.files?.[0]) }} /></label></div>
			<p className="share-status" role="status">{shareStatus}</p>
			{error ? <p className="error-message" role="alert">{error}</p> : null}
			<section aria-labelledby="performance-heading"><h2 id="performance-heading">Performance</h2><dl className="metrics">
				<div className="metric"><dt>Points</dt><dd>{metrics.points}</dd></div><div className="metric"><dt>Edges</dt><dd>{metrics.edges}</dd></div><div className="metric"><dt>β₀</dt><dd>{metrics.components}</dd></div><div className="metric"><dt>Step</dt><dd>{metrics.step}</dd></div><div className="metric"><dt>Frame</dt><dd>{metrics.frameMs.toFixed(1)} ms</dd></div><div className="metric"><dt>Dropped</dt><dd>{metrics.droppedSteps}</dd></div>
			</dl></section>
			<details className="inspector"><summary>Inspector</summary><dl><div><dt>Experiment</dt><dd>{flyingLinesDefinition.id} v{flyingLinesDefinition.stateVersion}</dd></div><div><dt>Timing</dt><dd>120 Hz · {flyingLinesDefinition.timing.deterministicTier}</dd></div><div><dt>Analysis</dt><dd>{metrics.searchBackend} · step {metrics.step} · {metrics.points} samples</dd></div><div><dt>Worker capability</dt><dd>{workerCapability.supported ? 'Supported by this browser.' : workerCapability.reason ?? 'Unavailable.'}</dd></div></dl></details>
		</aside>
		<section className="viewport" ref={viewportRef}><canvas key={`${runtimeKind}-${stateGeneration}`} ref={canvasRef} tabIndex={0} aria-label="Interactive Flying Lines simulation" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} /><div className="badge">seed · {seed} · search {metrics.searchBackend} · {runtimeKind}</div></section>
	</main>
}
