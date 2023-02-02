export default class FlyingPointsGL {
	constructor (w, h, properties) {
		const getPositionX = properties.getPositionMethod.x
		const getPositionY = properties.getPositionMethod.y
		const getPositionZ = properties.getPositionMethod.z
		this.particles = Array.from(new Array(properties.particlesCount)).map((_) => {
			const velocityX =
				(Math.random() * (properties.particleMaxVelocity * 1.5) -
					properties.particleMaxVelocity).toFixed(2)
			const velocityY =
				(Math.random() * (properties.particleMaxVelocity * 1.5) -
					properties.particleMaxVelocity).toFixed(2)
			const velocityZ =
				(Math.random() * (properties.particleMaxVelocity * 0.5) -
					properties.particleMaxVelocity * 0.1).toFixed(2)

			return {
				w,
				h,
				d: properties.d,
				x: Math.round((0.5 - Math.random()) * w),
				y: Math.round((0.5 - Math.random()) * h),
				z: 1,
				velocityX,
				velocityY,
				velocityZ,
				isStart: false,
				start: 0,
				position () {
					this.velocityX = getPositionX(this.x, this.w / 2, this.velocityX, properties.margin)
					this.velocityY = getPositionY(this.y, this.h / 2, this.velocityY, properties.margin)
					this.velocityZ = getPositionZ(this.z, this.d, this.velocityZ, properties.margin)
					this.x += this.velocityX
					this.y += this.velocityY
					this.z += this.velocityZ
				},
			}
		})
	}
}
