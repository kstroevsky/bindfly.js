import type { RandomSource, SeededRandomSnapshot, Simulation, SimulationEnvironment, SimulationStep, Viewport } from '../../core/index.ts'
import { restoreSeededRandom } from '../../core/index.ts'

import type { FlyingLinesInput, FlyingLinesParameters, FlyingLinesParticle, FlyingLinesState } from './types.ts'

export interface CreateFlyingLinesSimulationInput {
	readonly environment: SimulationEnvironment
	readonly parameters: FlyingLinesParameters
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

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
			particles: [],
			connectionRadius: parameters.connectionRadius,
			background: parameters.background,
		}
		this.reset()
	}

	private bounds() {
		const horizontalMargin = Math.min(this.parameters.margin, this.viewport.cssWidth / 2)
		const verticalMargin = Math.min(this.parameters.margin, this.viewport.cssHeight / 2)
		return {
			minX: horizontalMargin,
			maxX: this.viewport.cssWidth - horizontalMargin,
			minY: verticalMargin,
			maxY: this.viewport.cssHeight - verticalMargin,
		}
	}

	private velocity() {
		if (this.parameters.maxSpeed === 0) return { velocityX: 0, velocityY: 0 }
		const angle = this.random.nextBetween(0, Math.PI * 2)
		const speed = this.random.nextBetween(0, this.parameters.maxSpeed)
		return {
			velocityX: Math.cos(angle) * speed,
			velocityY: Math.sin(angle) * speed,
		}
	}

	private lifeSeconds() {
		return this.random.nextBetween(
			this.parameters.particleLifetimeSeconds / 2,
			this.parameters.particleLifetimeSeconds,
		)
	}

	private createParticle(position?: { readonly x: number; readonly y: number }): FlyingLinesParticle {
		const bounds = this.bounds()
		const velocity = this.velocity()
		return {
			id: this.nextId++,
			x: position ? clamp(position.x, bounds.minX, bounds.maxX) : this.random.nextBetween(bounds.minX, bounds.maxX),
			y: position ? clamp(position.y, bounds.minY, bounds.maxY) : this.random.nextBetween(bounds.minY, bounds.maxY),
			...velocity,
			lifeSeconds: this.lifeSeconds(),
		}
	}

	private respawn(particle: FlyingLinesParticle): void {
		const replacement = this.createParticle()
		particle.x = replacement.x
		particle.y = replacement.y
		particle.velocityX = replacement.velocityX
		particle.velocityY = replacement.velocityY
		particle.lifeSeconds = replacement.lifeSeconds
		this.nextId--
	}

	step(frame: SimulationStep): void {
		if (!Number.isFinite(frame.dtSeconds) || frame.dtSeconds < 0) {
			throw new RangeError('Flying Lines dtSeconds must be finite and non-negative.')
		}

		const bounds = this.bounds()
		for (const particle of this.state.particles) {
			let nextX = particle.x + particle.velocityX * frame.dtSeconds
			let nextY = particle.y + particle.velocityY * frame.dtSeconds

			if ((nextX > bounds.maxX && particle.velocityX > 0) || (nextX < bounds.minX && particle.velocityX < 0)) {
				particle.velocityX *= -1
				nextX = particle.x + particle.velocityX * frame.dtSeconds
			}
			if ((nextY > bounds.maxY && particle.velocityY > 0) || (nextY < bounds.minY && particle.velocityY < 0)) {
				particle.velocityY *= -1
				nextY = particle.y + particle.velocityY * frame.dtSeconds
			}

			particle.x = clamp(nextX, bounds.minX, bounds.maxX)
			particle.y = clamp(nextY, bounds.minY, bounds.maxY)
			particle.lifeSeconds -= frame.dtSeconds
			if (particle.lifeSeconds <= 0) this.respawn(particle)
		}
	}

	applyInput(input: FlyingLinesInput): void {
		switch (input.type) {
			case 'add-point':
				this.state.particles.push(this.createParticle(input))
				break
			case 'move-point': {
				const particle = this.state.particles.find(({ id }) => id === input.id)
				if (!particle) return
				const bounds = this.bounds()
				particle.x = clamp(input.x, bounds.minX, bounds.maxX)
				particle.y = clamp(input.y, bounds.minY, bounds.maxY)
				break
			}
			case 'remove-nearest': {
				let nearestIndex = -1
				let nearestDistanceSquared = input.maxDistance * input.maxDistance
				for (let index = 0; index < this.state.particles.length; index++) {
					const particle = this.state.particles[index]
					if (!particle) continue
					const dx = particle.x - input.x
					const dy = particle.y - input.y
					const distanceSquared = dx * dx + dy * dy
					if (distanceSquared <= nearestDistanceSquared) {
						nearestDistanceSquared = distanceSquared
						nearestIndex = index
					}
				}
				if (nearestIndex >= 0) this.state.particles.splice(nearestIndex, 1)
				break
			}
		}
	}

	resize(viewport: Viewport): void {
		this.viewport = viewport
		const bounds = this.bounds()
		for (const particle of this.state.particles) {
			particle.x = clamp(particle.x, bounds.minX, bounds.maxX)
			particle.y = clamp(particle.y, bounds.minY, bounds.maxY)
		}
	}

	reset(): void {
		this.random = restoreSeededRandom(this.initialRandomSnapshot)
		this.nextId = 0
		this.state.particles.splice(0, this.state.particles.length)
		for (let index = 0; index < this.parameters.particleCount; index++) {
			this.state.particles.push(this.createParticle())
		}
	}

	dispose(): void {
		this.state.particles.splice(0, this.state.particles.length)
	}
}

export const createFlyingLinesSimulation = ({
	environment,
	parameters,
}: CreateFlyingLinesSimulationInput): Simulation<FlyingLinesState, FlyingLinesInput> =>
	new FlyingLinesSimulation(environment, parameters)
