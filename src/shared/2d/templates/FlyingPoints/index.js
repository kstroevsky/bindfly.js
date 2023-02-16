import { getPosition, getVelocity } from '../../../utils/canvas-helpers'

export default class FlyingPoints {
	constructor (w, h, properties) {
		this.particles = Array.from(new Array(properties.particlesCount)).map((_) => {
			const velocity = getVelocity(properties.particleMaxVelocity)

			return {
				x: Math.random() * w,
				y: Math.random() * h,
				velocityX: velocity,
				velocityY: velocity,
				life: Math.random() * properties.particleLife * 60,
				isStart: false,
				start: 0,
				position () {
					this.velocityX = getPosition(this.x, w, this.velocityX, properties.margin)
					this.velocityY = getPosition(this.y, h, this.velocityY, properties.margin)
					this.x += this.velocityX
					this.y += this.velocityY
				},
				reCalculateLife () {
					if (!properties.isImmortal) {
						if (this.life < 1) {
							this.x = Math.random() * w
							this.y = Math.random() * h
							this.life = Math.random() * properties.particleLife * 60
						}
						if (this.start >= 1) this.isStart = false
						this.life--
					}
					if (this.isStart) this.start = this.start + 0.0001
				}
			}
		})
	}
}
