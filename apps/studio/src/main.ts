import { analyzeProximityGraph } from '../../../src-v2/analysis/index.ts'
import { createSeededRandom, createViewport, normalizeParameters } from '../../../src-v2/core/index.ts'
import type { ParameterValues, Simulation, Viewport } from '../../../src-v2/core/index.ts'
import { experimentRegistry, flyingLinesParameters } from '../../../src-v2/effects/index.ts'
import type { FlyingLinesInput, FlyingLinesState } from '../../../src-v2/effects/index.ts'
import { createFlyingLinesCanvasRenderer } from '../../../src-v2/rendering/index.ts'
import type { FlyingLinesRenderView } from '../../../src-v2/rendering/index.ts'

import './styles.css'

const ROUTE = '#/lab/flying-lines'
const SEED = 'phase-3-flying-lines'

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

	app.innerHTML = `
		<main class="studio">
			<aside class="panel" aria-label="Experiment controls">
				<header>
					<div><p class="eyebrow">Bindfly 2 · Phase 3</p><h1>Flying Lines</h1></div>
					<p class="description">A deterministic, main-thread vertical slice using brute-force unique pairs.</p>
				</header>
				<section class="controls" aria-label="Parameters">
					<label class="control"><span class="control-row"><span>Particles</span><output id="particleCount-output">${parameters.particleCount}</output></span><input id="particleCount" type="range" min="1" max="500" step="1" value="${parameters.particleCount}" /></label>
					<label class="control"><span class="control-row"><span>Speed</span><output id="maxSpeed-output">${parameters.maxSpeed}</output></span><input id="maxSpeed" type="range" min="0" max="240" step="1" value="${parameters.maxSpeed}" /></label>
					<label class="control"><span class="control-row"><span>Radius</span><output id="connectionRadius-output">${parameters.connectionRadius}</output></span><input id="connectionRadius" type="range" min="1" max="500" step="1" value="${parameters.connectionRadius}" /></label>
				</section>
				<div class="actions"><button id="pause" type="button">Pause</button><button id="reset" type="button">Reset</button></div>
				<dl class="metrics" aria-label="Live graph metrics">
					<div class="metric"><dt>Points</dt><dd id="points-metric">0</dd></div>
					<div class="metric"><dt>Edges</dt><dd id="edges-metric">0</dd></div>
					<div class="metric"><dt>β₀</dt><dd id="components-metric">0</dd></div>
					<div class="metric"><dt>Frame</dt><dd id="frame-metric">0 ms</dd></div>
				</dl>
				<p class="hint">Click empty space to add a point. Drag a nearby point to move it. Shift-click near a point to remove it.</p>
			</aside>
			<section class="viewport" id="viewport"><canvas id="canvas" tabindex="0" aria-label="Interactive Flying Lines simulation"></canvas><div class="badge">seed · ${SEED}</div></section>
		</main>
	`

	const canvas = element<HTMLCanvasElement>('canvas')
	const viewportElement = element<HTMLElement>('viewport')
	const renderer = createFlyingLinesCanvasRenderer(canvas)
	let viewport: Viewport
	let simulation: Simulation<FlyingLinesState, FlyingLinesInput>
	let paused = false
	let frameIndex = 0
	let elapsedSeconds = 0
	let previousTimestamp = performance.now()
	let animationFrameId = 0
	let draggingId: number | undefined

	const measureViewport = () => createViewport({
		cssWidth: Math.max(1, viewportElement.clientWidth),
		cssHeight: Math.max(1, viewportElement.clientHeight),
		devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
	})

	const rebuild = () => {
		viewport = measureViewport()
		renderer.resize(viewport)
		simulation?.dispose()
		simulation = definition.createSimulation({
			random: createSeededRandom(SEED),
			viewport,
		}, parameters)
		frameIndex = 0
		elapsedSeconds = 0
		previousTimestamp = performance.now()
	}

	const graphForFrame = () => analyzeProximityGraph({
		points: simulation.state.particles,
		connectionRadius: simulation.state.connectionRadius,
	})

	const renderFrame = (timestamp: number) => {
		const frameStartedAt = performance.now()
		const rawDeltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000)
		const dtSeconds = paused ? 0 : Math.min(rawDeltaSeconds, 0.05)
		previousTimestamp = timestamp

		if (!paused) {
			elapsedSeconds += dtSeconds
			simulation.step({ index: frameIndex, dtSeconds, elapsedSeconds })
		}

		const graph = graphForFrame()
		const view: FlyingLinesRenderView = {
			background: simulation.state.background,
			particles: simulation.state.particles,
			edges: graph.edges,
		}
		renderer.render(view, { frameIndex, simulationStepIndex: frameIndex, interpolationAlpha: 0 })

		if (frameIndex % 6 === 0) {
			element<HTMLElement>('points-metric').textContent = String(simulation.state.particles.length)
			element<HTMLElement>('edges-metric').textContent = String(graph.edges.length)
			element<HTMLElement>('components-metric').textContent = String(graph.components.length)
			element<HTMLElement>('frame-metric').textContent = `${(performance.now() - frameStartedAt).toFixed(1)} ms`
		}
		frameIndex++
		animationFrameId = window.requestAnimationFrame(renderFrame)
	}

	const updateParameter = (parameterId: 'particleCount' | 'maxSpeed' | 'connectionRadius', rawValue: string) => {
		const normalized = normalizeParameters(flyingLinesParameters, {
			...parameters,
			[parameterId]: Number(rawValue),
		})
		if (!normalized.ok) throw new Error(normalized.issues[0]?.message ?? 'Invalid parameter change.')
		parameters = normalized.value
		element<HTMLOutputElement>(`${parameterId}-output`).value = rawValue
		rebuild()
	}

	for (const parameterId of ['particleCount', 'maxSpeed', 'connectionRadius'] as const) {
		element<HTMLInputElement>(parameterId).addEventListener('input', (event) => {
			updateParameter(parameterId, (event.currentTarget as HTMLInputElement).value)
		})
	}

	element<HTMLButtonElement>('pause').addEventListener('click', (event) => {
		paused = !paused
		;(event.currentTarget as HTMLButtonElement).textContent = paused ? 'Resume' : 'Pause'
	})
	element<HTMLButtonElement>('reset').addEventListener('click', () => simulation.reset())

	const canvasPoint = (event: PointerEvent) => {
		const bounds = canvas.getBoundingClientRect()
		return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
	}
	const nearestId = ({ x, y }: { readonly x: number; readonly y: number }, maxDistance: number) => {
		let id: number | undefined
		let best = maxDistance * maxDistance
		for (const particle of simulation.state.particles) {
			const dx = particle.x - x
			const dy = particle.y - y
			const distance = dx * dx + dy * dy
			if (distance <= best) { best = distance; id = particle.id }
		}
		return id
	}

	canvas.addEventListener('pointerdown', (event) => {
		const point = canvasPoint(event)
		if (event.shiftKey) {
			simulation.applyInput({ type: 'remove-nearest', ...point, maxDistance: 18 })
			return
		}
		const id = nearestId(point, 14)
		if (id === undefined) simulation.applyInput({ type: 'add-point', ...point })
		else { draggingId = id; canvas.setPointerCapture(event.pointerId) }
	})
	canvas.addEventListener('pointermove', (event) => {
		if (draggingId === undefined) return
		simulation.applyInput({ type: 'move-point', id: draggingId, ...canvasPoint(event) })
	})
	const endDrag = (event: PointerEvent) => {
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
		draggingId = undefined
	}
	canvas.addEventListener('pointerup', endDrag)
	canvas.addEventListener('pointercancel', endDrag)

	const resizeObserver = new ResizeObserver(rebuild)
	resizeObserver.observe(viewportElement)
	rebuild()
	animationFrameId = window.requestAnimationFrame(renderFrame)

	window.addEventListener('beforeunload', () => {
		window.cancelAnimationFrame(animationFrameId)
		resizeObserver.disconnect()
		simulation.dispose()
		renderer.dispose()
	}, { once: true })
}

void bootstrap().catch((error: unknown) => {
	console.error(error)
	const app = document.getElementById('app')
	if (app) app.innerHTML = `<main class="error"><p class="eyebrow">Bindfly 2 Studio</p><h1>Unable to start</h1><pre>${error instanceof Error ? error.message : 'Unknown error'}</pre></main>`
})
