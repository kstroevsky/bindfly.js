import type { RandomSource, SeededRandomSnapshot, Simulation, SimulationEnvironment, SimulationStep, Viewport } from '../../core/index.ts'
import { restoreSeededRandom } from '../../core/index.ts'

import type { FlyingLinesInput, FlyingLinesParameters, FlyingLinesParticleBuffer, FlyingLinesState } from './types.ts'

export interface CreateFlyingLinesSimulationInput {
	readonly environment: SimulationEnvironment
	readonly parameters: FlyingLinesParameters
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const capacityFor = (minimum: number): number => {
	let capacity = 16
	while (capacity < minimum) capacity *= 2
	return capacity
}

const createBuffer = (capacity: number): FlyingLinesParticleBuffer => ({
	count: 0,
	capacity,
	ids: new Uint32Array(capacity),
	x: new Float64Array(capacity),
	y: new Float64Array(capacity),
	velocityX: new Float64Array(capacity),
	velocityY: new Float64Array(capacity),
	lifeSeconds: new Float64Array(capacity),
})

class FlyingLinesSimulation implements Simulation<FlyingLinesState, FlyingLinesInput> {
	readonly state: FlyingLinesState
	private readonly initialRandomSnapshot: SeededRandomSnapshot
	private viewport: Viewport
	private readonly parameters: FlyingLinesParameters
	private random: RandomSource
	private nextId = 0

	constructor(environment: SimulationEnvironment, parameters: FlyingLinesParameters) {
		this.viewport = environment.viewport
		this.parameters = parameters
		this.random = environment.random
		this.initialRandomSnapshot = environment.random.snapshot()
		this.state = {
			particles: createBuffer(capacityFor(parameters.particleCount)),
			connectionRadius: parameters.connectionRadius,
			background: parameters.background,
		}
		this.reset()
	}

	private ensureCapacity(minimum: number): void {
		const particles = this.state.particles
		if (minimum <= particles.capacity) return
		const capacity = capacityFor(minimum)
		const ids = new Uint32Array(capacity)
		const x = new Float64Array(capacity)
		const y = new Float64Array(capacity)
		const velocityX = new Float64Array(capacity)
		const velocityY = new Float64Array(capacity)
		const lifeSeconds = new Float64Array(capacity)
		ids.set(particles.ids.subarray(0, particles.count))
		x.set(particles.x.subarray(0, particles.count))
		y.set(particles.y.subarray(0, particles.count))
		velocityX.set(particles.velocityX.subarray(0, particles.count))
		velocityY.set(particles.velocityY.subarray(0, particles.count))
		lifeSeconds.set(particles.lifeSeconds.subarray(0, particles.count))
		Object.assign(particles, { capacity, ids, x, y, velocityX, velocityY, lifeSeconds })
	}

	private writeParticle(index: number, id: number, position?: { readonly x: number; readonly y: number }): void {
		const particles = this.state.particles
		const minX = Math.min(this.parameters.margin, this.viewport.cssWidth / 2)
		const minY = Math.min(this.parameters.margin, this.viewport.cssHeight / 2)
		const maxX = this.viewport.cssWidth - minX
		const maxY = this.viewport.cssHeight - minY
		const angle = this.parameters.maxSpeed === 0 ? 0 : this.random.nextBetween(0, Math.PI * 2)
		const speed = this.parameters.maxSpeed === 0 ? 0 : this.random.nextBetween(0, this.parameters.maxSpeed)
		particles.ids[index] = id
		particles.x[index] = position ? clamp(position.x, minX, maxX) : this.random.nextBetween(minX, maxX)
		particles.y[index] = position ? clamp(position.y, minY, maxY) : this.random.nextBetween(minY, maxY)
		particles.velocityX[index] = Math.cos(angle) * speed
		particles.velocityY[index] = Math.sin(angle) * speed
		particles.lifeSeconds[index] = this.random.nextBetween(
			this.parameters.particleLifetimeSeconds / 2,
			this.parameters.particleLifetimeSeconds,
		)
	}

	step(frame: SimulationStep): void {
		if (!Number.isFinite(frame.dtSeconds) || frame.dtSeconds < 0) {
			throw new RangeError('Flying Lines dtSeconds must be finite and non-negative.')
		}
		const particles = this.state.particles
		const minX = Math.min(this.parameters.margin, this.viewport.cssWidth / 2)
		const minY = Math.min(this.parameters.margin, this.viewport.cssHeight / 2)
		const maxX = this.viewport.cssWidth - minX
		const maxY = this.viewport.cssHeight - minY
		for (let index = 0; index < particles.count; index++) {
			let velocityX = particles.velocityX[index] ?? 0
			let velocityY = particles.velocityY[index] ?? 0
			let nextX = (particles.x[index] ?? 0) + velocityX * frame.dtSeconds
			let nextY = (particles.y[index] ?? 0) + velocityY * frame.dtSeconds
			if ((nextX > maxX && velocityX > 0) || (nextX < minX && velocityX < 0)) {
				velocityX *= -1
				particles.velocityX[index] = velocityX
				nextX = (particles.x[index] ?? 0) + velocityX * frame.dtSeconds
			}
			if ((nextY > maxY && velocityY > 0) || (nextY < minY && velocityY < 0)) {
				velocityY *= -1
				particles.velocityY[index] = velocityY
				nextY = (particles.y[index] ?? 0) + velocityY * frame.dtSeconds
			}
			particles.x[index] = clamp(nextX, minX, maxX)
			particles.y[index] = clamp(nextY, minY, maxY)
			particles.lifeSeconds[index] = (particles.lifeSeconds[index] ?? 0) - frame.dtSeconds
			if ((particles.lifeSeconds[index] ?? 0) <= 0) this.writeParticle(index, particles.ids[index] ?? 0)
		}
	}

	applyInput(input: FlyingLinesInput): void {
		const particles = this.state.particles
		switch (input.type) {
			case 'add-point':
				if (particles.count >= 500) break
				this.ensureCapacity(particles.count + 1)
				this.writeParticle(particles.count, this.nextId++, input)
				particles.count++
				break
			case 'move-point': {
				const minX = Math.min(this.parameters.margin, this.viewport.cssWidth / 2)
				const minY = Math.min(this.parameters.margin, this.viewport.cssHeight / 2)
				for (let index = 0; index < particles.count; index++) {
					if (particles.ids[index] !== input.id) continue
					particles.x[index] = clamp(input.x, minX, this.viewport.cssWidth - minX)
					particles.y[index] = clamp(input.y, minY, this.viewport.cssHeight - minY)
					break
				}
				break
			}
			case 'move-nearest': {
				let nearestIndex = -1
				let nearestDistanceSquared = input.maxDistance * input.maxDistance
				for (let index = 0; index < particles.count; index++) {
					const dx = (particles.x[index] ?? 0) - input.fromX
					const dy = (particles.y[index] ?? 0) - input.fromY
					const distanceSquared = dx * dx + dy * dy
					if (distanceSquared <= nearestDistanceSquared) {
						nearestIndex = index
						nearestDistanceSquared = distanceSquared
					}
				}
				if (nearestIndex < 0) break
				const minX = Math.min(this.parameters.margin, this.viewport.cssWidth / 2)
				const minY = Math.min(this.parameters.margin, this.viewport.cssHeight / 2)
				particles.x[nearestIndex] = clamp(input.x, minX, this.viewport.cssWidth - minX)
				particles.y[nearestIndex] = clamp(input.y, minY, this.viewport.cssHeight - minY)
				break
			}
			case 'remove-nearest': {
				let nearestIndex = -1
				let nearestDistanceSquared = input.maxDistance * input.maxDistance
				for (let index = 0; index < particles.count; index++) {
					const dx = (particles.x[index] ?? 0) - input.x
					const dy = (particles.y[index] ?? 0) - input.y
					const distanceSquared = dx * dx + dy * dy
					if (distanceSquared <= nearestDistanceSquared) {
						nearestDistanceSquared = distanceSquared
						nearestIndex = index
					}
				}
				if (nearestIndex < 0) break
				particles.ids.copyWithin(nearestIndex, nearestIndex + 1, particles.count)
				particles.x.copyWithin(nearestIndex, nearestIndex + 1, particles.count)
				particles.y.copyWithin(nearestIndex, nearestIndex + 1, particles.count)
				particles.velocityX.copyWithin(nearestIndex, nearestIndex + 1, particles.count)
				particles.velocityY.copyWithin(nearestIndex, nearestIndex + 1, particles.count)
				particles.lifeSeconds.copyWithin(nearestIndex, nearestIndex + 1, particles.count)
				particles.count--
				break
			}
		}
	}

	resize(viewport: Viewport): void {
		this.viewport = viewport
		const particles = this.state.particles
		const minX = Math.min(this.parameters.margin, viewport.cssWidth / 2)
		const minY = Math.min(this.parameters.margin, viewport.cssHeight / 2)
		for (let index = 0; index < particles.count; index++) {
			particles.x[index] = clamp(particles.x[index] ?? 0, minX, viewport.cssWidth - minX)
			particles.y[index] = clamp(particles.y[index] ?? 0, minY, viewport.cssHeight - minY)
		}
	}

	reset(): void {
		this.random = restoreSeededRandom(this.initialRandomSnapshot)
		this.nextId = 0
		const particles = this.state.particles
		this.ensureCapacity(this.parameters.particleCount)
		particles.count = this.parameters.particleCount
		for (let index = 0; index < particles.count; index++) this.writeParticle(index, this.nextId++)
	}

	dispose(): void {
		this.state.particles.count = 0
	}
}

export const createFlyingLinesSimulation = ({
	environment,
	parameters,
}: CreateFlyingLinesSimulationInput): Simulation<FlyingLinesState, FlyingLinesInput> =>
	new FlyingLinesSimulation(environment, parameters)
