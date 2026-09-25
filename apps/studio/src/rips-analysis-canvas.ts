import type { PointCloudSnapshot } from '../../../src-v2/analysis/point-cloud-snapshot.ts'
import type { RipsComplexResult } from '../../../src-v2/analysis/rips-complex.ts'

export interface RipsAnalysisCanvasView {
	readonly snapshot: PointCloudSnapshot
	readonly result: RipsComplexResult
}

const finiteBounds = (snapshot: PointCloudSnapshot) => {
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	for (let index = 0; index < snapshot.x.length; index++) {
		const x = snapshot.x[index]
		const y = snapshot.y[index]
		if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) continue
		minX = Math.min(minX, x)
		minY = Math.min(minY, y)
		maxX = Math.max(maxX, x)
		maxY = Math.max(maxY, y)
	}
	return Number.isFinite(minX)
		? { minX, minY, maxX, maxY }
		: { minX: 0, minY: 0, maxX: 1, maxY: 1 }
}

export const renderRipsAnalysisCanvas = (
	canvas: HTMLCanvasElement,
	view: RipsAnalysisCanvasView,
): void => {
	const width = Math.max(1, canvas.clientWidth)
	const height = Math.max(1, canvas.clientHeight)
	const pixelRatio = Math.max(1, window.devicePixelRatio || 1)
	const backingWidth = Math.max(1, Math.round(width * pixelRatio))
	const backingHeight = Math.max(1, Math.round(height * pixelRatio))
	if (canvas.width !== backingWidth) canvas.width = backingWidth
	if (canvas.height !== backingHeight) canvas.height = backingHeight
	const context = canvas.getContext('2d')
	if (!context) throw new Error('Analyze canvas requires a 2D rendering context.')
	context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
	context.clearRect(0, 0, width, height)
	context.fillStyle = '#050508'
	context.fillRect(0, 0, width, height)

	const bounds = finiteBounds(view.snapshot)
	const padding = Math.min(54, Math.max(24, Math.min(width, height) * 0.08))
	const spanX = Math.max(1, bounds.maxX - bounds.minX)
	const spanY = Math.max(1, bounds.maxY - bounds.minY)
	const scale = Math.max(1e-9, Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY))
	const drawnWidth = spanX * scale
	const drawnHeight = spanY * scale
	const offsetX = (width - drawnWidth) / 2 - bounds.minX * scale
	const offsetY = (height - drawnHeight) / 2 - bounds.minY * scale
	const pointX = (index: number) => (view.snapshot.x[index] ?? 0) * scale + offsetX
	const pointY = (index: number) => (view.snapshot.y[index] ?? 0) * scale + offsetY

	const triangles = view.result.triangles
	if (triangles.count > 0) {
		context.fillStyle = 'rgba(255, 121, 198, 0.075)'
		context.beginPath()
		for (let index = 0; index < triangles.count; index++) {
			const a = triangles.a[index]
			const b = triangles.b[index]
			const c = triangles.c[index]
			if (a === undefined || b === undefined || c === undefined) continue
			context.moveTo(pointX(a), pointY(a))
			context.lineTo(pointX(b), pointY(b))
			context.lineTo(pointX(c), pointY(c))
			context.closePath()
		}
		context.fill()
	}

	if (view.result.edgeCount > 0) {
		context.strokeStyle = 'rgba(139, 233, 253, 0.22)'
		context.lineWidth = 0.75
		context.beginPath()
		for (let index = 0; index < view.result.edgeCount; index++) {
			const source = view.result.edgeSourceIndices[index]
			const target = view.result.edgeTargetIndices[index]
			if (source === undefined || target === undefined) continue
			context.moveTo(pointX(source), pointY(source))
			context.lineTo(pointX(target), pointY(target))
		}
		context.stroke()
	}

	context.fillStyle = '#f4f4f6'
	for (let index = 0; index < view.snapshot.ids.length; index++) {
		context.beginPath()
		context.arc(pointX(index), pointY(index), 2, 0, Math.PI * 2)
		context.fill()
	}

	context.fillStyle = 'rgba(7, 7, 11, 0.78)'
	context.fillRect(18, 18, 255, 60)
	context.fillStyle = '#d7d7df'
	context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace'
	context.fillText(`Pinned step ${view.snapshot.simulationStep} · ε ${view.result.epsilon.toFixed(0)} px`, 28, 42)
	context.fillStyle = '#9b9ba8'
	const triangleLabel = triangles.truncated
		? `${triangles.count.toLocaleString()} / ${triangles.totalCount.toLocaleString()} triangles (LOD)`
		: `${triangles.totalCount.toLocaleString()} triangles`
	context.fillText(`${view.result.edgeCount.toLocaleString()} edges · ${triangleLabel}`, 28, 62)
}
