import { createProximityGraphWorkspace, createUniformGridProximityGraphWorkspace, shouldUseUniformGrid } from '../../../src-v2/analysis/index.ts'
import { createSeededRandom, createViewport, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterPatch, ParameterValues, Simulation, Viewport } from '../../../src-v2/core/index.ts'
import { experimentRegistry, flyingLinesParameters } from '../../../src-v2/effects/index.ts'
import type { FlyingLinesInput, FlyingLinesState } from '../../../src-v2/effects/index.ts'
import { createFlyingLinesCanvasRenderer } from '../../../src-v2/rendering/index.ts'
import type { FlyingLinesRenderView } from '../../../src-v2/rendering/index.ts'
import { browserAnimationFrameScheduler, FixedStepClock, FixedStepLoop, MainThreadRuntime, WorkerRuntime, probeWorkerCanvasSupport } from '../../../src-v2/runtime/index.ts'
import type { RuntimeEvent } from '../../../src-v2/runtime/index.ts'

import './styles.css'

const ROUTE = '#/lab/flying-lines'
const SEED = 'bindfly-flying-lines-simple-v1'

const element = <ElementType extends HTMLElement>(id: string): ElementType => {
	const found = document.getElementById(id)
	if (!found) throw new Error(`Studio element '#${id}' is missing.`)
	return found as ElementType
}

const bootstrap = async () => {
	const app = element<HTMLDivElement>('app')
	if (!window.location.hash) window.location.hash = ROUTE

	if (window.location.hash !== ROUTE) {
		app.innerHTML = `<main class="error"><p class="eyebrow">Bindfly 2 Studio</p><h1>Unknown route</h1><p>Use <code>${ROUTE}</code>.</p></main>`
		return
	}

	const definition = await experimentRegistry.load('flying-lines')
	const defaults = normalizeParameters(flyingLinesParameters, {})
	if (!defaults.ok) throw new Error('Flying Lines defaults failed validation.')
	let parameters: ParameterValues<typeof flyingLinesParameters> = defaults.value
	let requestedParameters = parameters
	const requestedRuntime = new URL(window.location.href).searchParams.get('runtime') === 'worker' ? 'worker' : 'main'

	app.innerHTML = `
		<main class="studio">
			<aside class="panel" aria-label="Experiment controls">
				<header>
					<div><p class="eyebrow">Bindfly 2 · Phase 7</p><h1>Flying Lines</h1></div>
					<p class="description">Switchable main/worker CPU runtime with adaptive search.</p>
				</header>
				<section class="controls" aria-label="Parameters">
					<label class="control"><span class="control-row"><span>Particles</span><output id="particleCount-output">${parameters.particleCount}</output></span><input id="particleCount" type="range" min="1" max="500" step="1" value="${parameters.particleCount}" /></label>
					<label class="control"><span class="control-row"><span>Speed</span><output id="maxSpeed-output">${parameters.maxSpeed}</output></span><input id="maxSpeed" type="range" min="0" max="240" step="1" value="${parameters.maxSpeed}" /></label>
					<label class="control"><span class="control-row"><span>Radius</span><output id="connectionRadius-output">${parameters.connectionRadius}</output></span><input id="connectionRadius" type="range" min="1" max="500" step="1" value="${parameters.connectionRadius}" /></label>
				</section>
				<label class="runtime-control"><span>Runtime</span><select id="runtime"><option value="main" ${requestedRuntime === 'main' ? 'selected' : ''}>Main thread</option><option value="worker" ${requestedRuntime === 'worker' ? 'selected' : ''}>Worker</option></select></label>
				<div class="actions"><button id="pause" type="button">Pause</button><button id="reset" type="button">Reset</button></div>
				<dl class="metrics" aria-label="Live graph metrics">
					<div class="metric"><dt>Points</dt><dd id="points-metric">0</dd></div>
					<div class="metric"><dt>Edges</dt><dd id="edges-metric">0</dd></div>
					<div class="metric"><dt>β₀</dt><dd id="components-metric">0</dd></div>
					<div class="metric"><dt>Step</dt><dd id="step-metric">0</dd></div>
					<div class="metric"><dt>Frame</dt><dd id="frame-metric">0 ms</dd></div>
					<div class="metric"><dt>Dropped</dt><dd id="dropped-metric">0</dd></div>
				</dl>
				<p class="hint">Click empty space to add a point. Drag a nearby point to move it. Shift-click near a point to remove it.</p>
			</aside>
			<section class="viewport" id="viewport"><canvas id="canvas" tabindex="0" aria-label="Interactive Flying Lines simulation"></canvas><div class="badge">seed · ${SEED} · search <span id="search-backend">pending</span></div></section>
		</main>
	`

	const canvas = element<HTMLCanvasElement>('canvas')
	const viewportElement = element<HTMLElement>('viewport')
	const measureViewport = () => createViewport({
		cssWidth: Math.max(1, viewportElement.clientWidth),
		cssHeight: Math.max(1, viewportElement.clientHeight),
		devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
	})
	let viewport: Viewport = measureViewport()
	const interactiveParameterIds = ['particleCount', 'maxSpeed', 'connectionRadius'] as const
	const navigateRuntime = (runtime: 'main' | 'worker') => {
		const url = new URL(window.location.href)
		if (runtime === 'worker') url.searchParams.set('runtime', 'worker')
		else url.searchParams.delete('runtime')
		window.location.assign(url)
	}
	element<HTMLSelectElement>('runtime').addEventListener('change', (event) => {
		navigateRuntime((event.currentTarget as HTMLSelectElement).value === 'worker' ? 'worker' : 'main')
	})

	if (requestedRuntime === 'worker') {
		const capability = probeWorkerCanvasSupport(canvas)
		if (capability.supported) {
			const offscreenCanvas = canvas.transferControlToOffscreen()
			let paused = false
			let dragPoint: { x: number; y: number } | undefined
			let dragMoved = false
			let pendingPatch: ParameterPatch<typeof flyingLinesParameters> = {}
			let patchFrameId: number | undefined
			const applyTelemetry = (event: RuntimeEvent) => {
				if (event.type !== 'telemetry' || typeof event.payload !== 'object' || event.payload === null) return
				const telemetry = event.payload as Record<string, unknown>
				element<HTMLElement>('points-metric').textContent = String(telemetry.points ?? 0)
				element<HTMLElement>('edges-metric').textContent = String(telemetry.edges ?? 0)
				element<HTMLElement>('components-metric').textContent = String(telemetry.components ?? 0)
				element<HTMLElement>('step-metric').textContent = String(telemetry.step ?? 0)
				element<HTMLElement>('frame-metric').textContent = `${Number(telemetry.frameMs ?? 0).toFixed(1)} ms`
				element<HTMLElement>('search-backend').textContent = String(telemetry.searchBackend ?? 'pending')
			}
			const runtime = new WorkerRuntime<typeof flyingLinesParameters, FlyingLinesInput, {
				canvas: OffscreenCanvas
				viewport: Viewport
				parameters: ParameterValues<typeof flyingLinesParameters>
				seed: string
			}>({
				createWorker: () => new Worker(new URL('./flying-lines.worker.ts', import.meta.url), { type: 'module' }),
				initializePayload: { canvas: offscreenCanvas, viewport, parameters, seed: SEED },
				initializeTransfer: [offscreenCanvas],
				onEvent: applyTelemetry,
				onFailure: () => navigateRuntime('main'),
			})
			try {
				await runtime.initialize()
				await runtime.start()
			} catch {
				navigateRuntime('main')
				return
			}
			const schedulePatch = (patch: ParameterPatch<typeof flyingLinesParameters>) => {
				pendingPatch = { ...pendingPatch, ...patch }
				if (patchFrameId !== undefined) return
				patchFrameId = window.requestAnimationFrame(() => {
					patchFrameId = undefined
					const patchToSend = pendingPatch
					pendingPatch = {}
					void runtime.updateParameters(patchToSend)
				})
			}

			for (const parameterId of interactiveParameterIds) {
				element<HTMLInputElement>(parameterId).addEventListener('input', (event) => {
					const rawValue = (event.currentTarget as HTMLInputElement).value
					element<HTMLOutputElement>(`${parameterId}-output`).value = rawValue
					schedulePatch({ [parameterId]: Number(rawValue) })
				})
			}
			element<HTMLButtonElement>('pause').addEventListener('click', (event) => {
				paused = !paused
				void (paused ? runtime.pause() : runtime.resume())
				;(event.currentTarget as HTMLButtonElement).textContent = paused ? 'Resume' : 'Pause'
			})
			element<HTMLButtonElement>('reset').addEventListener('click', () => { schedulePatch({}) })
			const canvasPoint = (event: PointerEvent) => {
				const bounds = canvas.getBoundingClientRect()
				return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
			}
			canvas.addEventListener('pointerdown', (event) => {
				const point = canvasPoint(event)
				if (event.shiftKey) void runtime.applyInput({ type: 'remove-nearest', ...point, maxDistance: 18 })
				else { dragPoint = point; dragMoved = false }
			})
			canvas.addEventListener('pointermove', (event) => {
				if (!dragPoint || event.buttons === 0) return
				const point = canvasPoint(event)
				if (Math.hypot(point.x - dragPoint.x, point.y - dragPoint.y) >= 2) dragMoved = true
				void runtime.applyInput({ type: 'move-nearest', fromX: dragPoint.x, fromY: dragPoint.y, ...point, maxDistance: 14 })
				dragPoint = point
			})
			canvas.addEventListener('pointerup', (event) => {
				if (dragPoint && !dragMoved) {
					const point = canvasPoint(event)
					void runtime.applyInput({ type: 'add-point', ...point })
				}
				dragPoint = undefined
			})
			const resizeObserver = new ResizeObserver(() => { void runtime.resize(measureViewport()) })
			resizeObserver.observe(viewportElement)
			window.addEventListener('beforeunload', () => {
				resizeObserver.disconnect()
				if (patchFrameId !== undefined) window.cancelAnimationFrame(patchFrameId)
				void runtime.dispose()
			}, { once: true })
			return
		}
		element<HTMLSelectElement>('runtime').value = 'main'
		element<HTMLElement>('search-backend').textContent = capability.reason ?? 'worker unavailable'
	}

	const renderer = createFlyingLinesCanvasRenderer(canvas)
	let simulation: Simulation<FlyingLinesState, FlyingLinesInput> = definition.createSimulation({
		random: createSeededRandom(SEED),
		viewport,
	}, parameters)
	let draggingId: number | undefined
	let droppedStepCount = 0
	const bruteGraphWorkspace = createProximityGraphWorkspace(500)
	const gridGraphWorkspace = createUniformGridProximityGraphWorkspace(500)
	let graphWorkspace = shouldUseUniformGrid(simulation.state.particles, simulation.state.connectionRadius)
		? gridGraphWorkspace
		: bruteGraphWorkspace
	element<HTMLElement>('search-backend').textContent = graphWorkspace === gridGraphWorkspace ? 'grid' : 'brute'
	let renderView: FlyingLinesRenderView = {
		background: simulation.state.background,
		particles: simulation.state.particles,
		edges: graphWorkspace.result,
	}

	const syncParameterControls = () => {
		for (const parameterId of interactiveParameterIds) {
			const value = String(parameters[parameterId])
			element<HTMLInputElement>(parameterId).value = value
			element<HTMLOutputElement>(`${parameterId}-output`).value = value
		}
	}

	const rebuildSimulation = () => {
		simulation.dispose()
		simulation = definition.createSimulation({
			random: createSeededRandom(SEED),
			viewport,
		}, parameters)
		graphWorkspace = shouldUseUniformGrid(simulation.state.particles, simulation.state.connectionRadius)
			? gridGraphWorkspace
			: bruteGraphWorkspace
		element<HTMLElement>('search-backend').textContent = graphWorkspace === gridGraphWorkspace ? 'grid' : 'brute'
		renderView = {
			background: simulation.state.background,
			particles: simulation.state.particles,
			edges: graphWorkspace.result,
		}
	}

	const graphForFrame = () => graphWorkspace.analyze(
		simulation.state.particles,
		simulation.state.connectionRadius,
	)

	const loop = new FixedStepLoop<FlyingLinesInput, ParameterPatch<typeof flyingLinesParameters>>({
		clock: new FixedStepClock({
			stepSeconds: definition.timing.fixedStepSeconds,
			maxCatchUpSteps: 8,
		}),
		scheduler: browserAnimationFrameScheduler,
		callbacks: {
			step: (step) => simulation.step(step),
			applyInput: (input) => simulation.applyInput(input),
			applyParameterPatch: (patch) => {
				const normalized = normalizeParameters(flyingLinesParameters, { ...parameters, ...patch })
				if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid parameter patch.')
				parameters = normalized.value
				rebuildSimulation()
			},
			reset: () => {
				droppedStepCount = 0
				draggingId = undefined
				requestedParameters = parameters
				syncParameterControls()
				element<HTMLElement>('dropped-metric').textContent = '0'
				simulation.reset()
			},
			resize: (nextViewport) => {
				viewport = nextViewport
				renderer.resize(viewport)
				simulation.resize(viewport)
			},
			dispose: () => {
				simulation.dispose()
				renderer.dispose()
			},
			onOverload: ({ droppedStepCount: dropped }) => {
				droppedStepCount += dropped
				element<HTMLElement>('dropped-metric').textContent = String(droppedStepCount)
			},
			onError: (error) => {
				console.error(error)
				element<HTMLElement>('frame-metric').textContent = 'failed'
			},
			render: (frame) => {
				const frameStartedAt = performance.now()
				const graph = graphForFrame()
				renderer.render(renderView, frame)

				if (frame.frameIndex % 6 === 0) {
					element<HTMLElement>('points-metric').textContent = String(simulation.state.particles.count)
					element<HTMLElement>('edges-metric').textContent = String(graph.edgeCount)
					element<HTMLElement>('components-metric').textContent = String(graph.componentCount)
					element<HTMLElement>('step-metric').textContent = String(frame.simulationStepIndex)
					element<HTMLElement>('frame-metric').textContent = `${(performance.now() - frameStartedAt).toFixed(1)} ms`
				}
			},
		},
	})
	const mainRuntime = new MainThreadRuntime<typeof flyingLinesParameters, FlyingLinesInput>(loop)

	const updateParameter = (parameterId: 'particleCount' | 'maxSpeed' | 'connectionRadius', rawValue: string) => {
		const normalized = normalizeParameters(flyingLinesParameters, {
			...requestedParameters,
			[parameterId]: Number(rawValue),
		})
		if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid parameter change.')
		requestedParameters = normalized.value
		element<HTMLOutputElement>(`${parameterId}-output`).value = rawValue
		void mainRuntime.updateParameters({ [parameterId]: Number(rawValue) })
	}

	for (const parameterId of interactiveParameterIds) {
		element<HTMLInputElement>(parameterId).addEventListener('input', (event) => {
			updateParameter(parameterId, (event.currentTarget as HTMLInputElement).value)
		})
	}

	element<HTMLButtonElement>('pause').addEventListener('click', (event) => {
		if (mainRuntime.state === 'running') void mainRuntime.pause()
		else void mainRuntime.resume()
		;(event.currentTarget as HTMLButtonElement).textContent = mainRuntime.state === 'paused' ? 'Resume' : 'Pause'
	})
	element<HTMLButtonElement>('reset').addEventListener('click', () => loop.reset())

	const canvasPoint = (event: PointerEvent) => {
		const bounds = canvas.getBoundingClientRect()
		return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
	}
	const nearestId = ({ x, y }: { readonly x: number; readonly y: number }, maxDistance: number) => {
		let id: number | undefined
		let best = maxDistance * maxDistance
		const particles = simulation.state.particles
		for (let index = 0; index < particles.count; index++) {
			const dx = (particles.x[index] ?? 0) - x
			const dy = (particles.y[index] ?? 0) - y
			const distance = dx * dx + dy * dy
			if (distance <= best) { best = distance; id = particles.ids[index] }
		}
		return id
	}

	canvas.addEventListener('pointerdown', (event) => {
		const point = canvasPoint(event)
		if (event.shiftKey) {
			void mainRuntime.applyInput({ type: 'remove-nearest', ...point, maxDistance: 18 })
			return
		}
		const id = nearestId(point, 14)
		if (id === undefined) void mainRuntime.applyInput({ type: 'add-point', ...point })
		else { draggingId = id; canvas.setPointerCapture(event.pointerId) }
	})
	canvas.addEventListener('pointermove', (event) => {
		if (draggingId === undefined) return
		void mainRuntime.applyInput({ type: 'move-point', id: draggingId, ...canvasPoint(event) })
	})
	const endDrag = (event: PointerEvent) => {
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
		draggingId = undefined
	}
	canvas.addEventListener('pointerup', endDrag)
	canvas.addEventListener('pointercancel', endDrag)

	const resizeObserver = new ResizeObserver(() => { void mainRuntime.resize(measureViewport()) })
	resizeObserver.observe(viewportElement)
	await mainRuntime.initialize()
	await mainRuntime.resize(viewport)
	await mainRuntime.start()

	window.addEventListener('beforeunload', () => {
		resizeObserver.disconnect()
		void mainRuntime.dispose()
	}, { once: true })
}

void bootstrap().catch((error: unknown) => {
	console.error(error)
	const app = document.getElementById('app')
	if (app) app.innerHTML = `<main class="error"><p class="eyebrow">Bindfly 2 Studio</p><h1>Unable to start</h1><pre>${error instanceof Error ? error.message : 'Unknown error'}</pre></main>`
})
