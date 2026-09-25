import type { FlyingLinesState } from '../../../src-v2/effects/flying-lines/types.ts'
import type { DiscreteMapState } from '../../../src-v2/effects/discrete-map/types.ts'
import type { VectorFieldState } from '../../../src-v2/effects/vector-field/types.ts'
import type { FlyingLinesRenderView } from '../../../src-v2/rendering/flying-lines.ts'
import type { PhasePortraitRenderView, PhasePortraitTrajectory } from '../../../src-v2/rendering/phase-portrait.ts'
import { extractScalarFieldContourSegments } from '../../../src-v2/rendering/scalar-field.ts'
import type { ScalarFieldRenderView } from '../../../src-v2/rendering/scalar-field.ts'

export interface Stage15ParityEvidence {
	readonly simulationChecksum: string
	readonly renderViewChecksum: string
	readonly postRenderSimulationChecksum: string
	readonly postRenderViewChecksum: string
}

class CanonicalChecksum {
	private first = 0x811c9dc5
	private second = 0x9e3779b9
	private readonly numberBuffer = new ArrayBuffer(8)
	private readonly numberView = new DataView(this.numberBuffer)
	private readonly numberBytes = new Uint8Array(this.numberBuffer)

	private byte(value: number): void {
		this.first = Math.imul(this.first ^ value, 0x01000193) >>> 0
		this.second = Math.imul(this.second ^ value, 0x85ebca6b) >>> 0
	}

	private length(value: number): void {
		for (let shift = 0; shift < 32; shift += 8) this.byte((value >>> shift) & 0xff)
	}

	number(value: number): void {
		this.byte(1)
		if (Number.isNaN(value)) {
			this.byte(1)
			return
		}
		if (value === Number.POSITIVE_INFINITY || value === Number.NEGATIVE_INFINITY) {
			this.byte(value > 0 ? 2 : 3)
			return
		}
		this.byte(Object.is(value, -0) ? 4 : 0)
		this.numberView.setFloat64(0, Object.is(value, -0) ? 0 : value, false)
		for (const byte of this.numberBytes) this.byte(byte)
	}

	string(value: string): void {
		this.byte(2)
		this.length(value.length)
		for (let index = 0; index < value.length; index++) {
			const code = value.charCodeAt(index)
			this.byte(code & 0xff)
			this.byte(code >>> 8)
		}
	}

	numbers(values: ArrayLike<number>, count = values.length): void {
		this.byte(3)
		this.length(count)
		for (let index = 0; index < count; index++) this.number(values[index] ?? Number.NaN)
	}

	digest(): string {
		return `${this.first.toString(16).padStart(8, '0')}${this.second.toString(16).padStart(8, '0')}`
	}
}

const checksum = (write: (target: CanonicalChecksum) => void) => {
	const target = new CanonicalChecksum()
	write(target)
	return target.digest()
}

const writeTrajectories = (target: CanonicalChecksum, trajectories: readonly PhasePortraitTrajectory[]) => {
	target.number(trajectories.length)
	for (const trajectory of trajectories) {
		target.number(trajectory.id)
		target.number(trajectory.x)
		target.number(trajectory.y)
		target.string(trajectory.status)
		target.numbers(trajectory.trailX)
		target.numbers(trajectory.trailY)
		if (trajectory.trailEpochs) target.numbers(trajectory.trailEpochs)
		else target.string('no-epochs')
	}
}

export const checksumFlyingLinesSimulation = (state: FlyingLinesState) => checksum((target) => {
	const { particles } = state
	target.number(particles.count)
	target.numbers(particles.ids, particles.count)
	target.numbers(particles.x, particles.count)
	target.numbers(particles.y, particles.count)
	target.numbers(particles.velocityX, particles.count)
	target.numbers(particles.velocityY, particles.count)
	target.numbers(particles.lifeSeconds, particles.count)
})

export const checksumFlyingLinesRenderView = (view: FlyingLinesRenderView) => checksum((target) => {
	target.string(view.background)
	target.number(view.particles.count)
	target.numbers(view.particles.ids, view.particles.count)
	target.numbers(view.particles.x, view.particles.count)
	target.numbers(view.particles.y, view.particles.count)
	target.number(view.edges.edgeCount)
	target.numbers(view.edges.sourceIndices, view.edges.edgeCount)
	target.numbers(view.edges.targetIndices, view.edges.edgeCount)
	target.numbers(view.edges.distances, view.edges.edgeCount)
	target.numbers(view.edges.opacities, view.edges.edgeCount)
})

export const checksumVectorFieldSimulation = (state: VectorFieldState) => checksum((target) => {
	target.number(state.time)
	target.number(state.configurationEpoch)
	target.number(state.nextTrajectoryId)
	writeTrajectories(target, state.trajectories)
})

export const checksumDiscreteMapSimulation = (state: DiscreteMapState) => checksum((target) => {
	target.number(state.iteration)
	target.number(state.configurationEpoch)
	target.number(state.nextOrbitId)
	writeTrajectories(target, state.orbits)
})

export const checksumPhasePortraitRenderView = (view: PhasePortraitRenderView) => checksum((target) => {
	target.string(view.background)
	target.number(view.domainRadius)
	target.string(view.title)
	target.string(view.trajectoryStyle ?? 'curve')
	writeTrajectories(target, view.trajectories)
	const field = view.field ?? []
	target.number(field.length)
	for (const sample of field) {
		target.number(sample.x)
		target.number(sample.y)
		target.number(sample.dx)
		target.number(sample.dy)
	}
})

export const checksumScalarFieldSimulation = () => checksum((target) => target.string('static-field'))

export const checksumScalarFieldRenderView = (view: ScalarFieldRenderView) => checksum((target) => {
	target.string(view.background)
	target.number(view.domainRadius)
	target.string(view.title)
	target.number(view.contourLevel)
	target.number(view.valueScale)
	const { grid } = view
	target.number(grid.columns)
	target.number(grid.rows)
	target.number(grid.minX)
	target.number(grid.maxX)
	target.number(grid.minY)
	target.number(grid.maxY)
	target.number(grid.validCount)
	target.number(grid.invalidCount)
	target.numbers(grid.values)
	const contours = extractScalarFieldContourSegments(grid, view.contourLevel)
	target.number(contours.length)
	for (const segment of contours) {
		target.number(segment.start.x)
		target.number(segment.start.y)
		target.number(segment.end.x)
		target.number(segment.end.y)
	}
})

export const stage15ParityEvidence = (
	before: { readonly simulationChecksum: string; readonly renderViewChecksum: string },
	after: { readonly simulationChecksum: string; readonly renderViewChecksum: string },
): Stage15ParityEvidence => ({
	...before,
	postRenderSimulationChecksum: after.simulationChecksum,
	postRenderViewChecksum: after.renderViewChecksum,
})
