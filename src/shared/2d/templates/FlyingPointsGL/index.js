import { getPosition } from '../../../utils'

export default class FlyingPoints {
	constructor (w, h, d, properties) {
		this.particles = Array.from(new Array(properties.particleCount)).map((_) => {
			const velocityX =
				(Math.random() * (properties.particleMaxVelocity * 2) -
					properties.particleMaxVelocity).toFixed(2)
			const velocityY =
				(Math.random() * (properties.particleMaxVelocity * 2) -
					properties.particleMaxVelocity).toFixed(2)
			const velocityZ =
				(Math.random() * (properties.particleMaxVelocity * 2) -
					properties.particleMaxVelocity).toFixed(2)

			return {
				w,
				h,
				d,
				x: Math.round((0.5 - Math.random()) * w),
				y: Math.round((0.5 - Math.random()) * h),
				z: 1,
				velocityX,
				velocityY,
				velocityZ,
				isStart: false,
				start: 0,
				position () {
					this.velocityX = getPosition(this.x, this.w, this.velocityX, properties.margin)
					this.velocityY = getPosition(this.y, this.h, this.velocityY, properties.margin)
					this.velocityZ = getPosition(this.z, this.d, this.velocityZ, properties.margin)
					this.x += this.velocityX
					this.y += this.velocityY
					this.z += this.velocityZ
				},
			}
		})
	}
}
