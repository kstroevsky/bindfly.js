import type { MovingPointState } from './types.ts'

export const snapshotMovingPointState = (state: Readonly<MovingPointState>): MovingPointState => ({
	particles: {
		count: state.particles.count,
		capacity: state.particles.count,
		ids: state.particles.ids.slice(0, state.particles.count),
		x: state.particles.x.slice(0, state.particles.count),
		y: state.particles.y.slice(0, state.particles.count),
		velocityX: state.particles.velocityX.slice(0, state.particles.count),
		velocityY: state.particles.velocityY.slice(0, state.particles.count),
		lifeSeconds: state.particles.lifeSeconds.slice(0, state.particles.count),
	},
})
