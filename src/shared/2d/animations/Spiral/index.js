import { generateColorsByCount } from '../../../utils/color-helpers'
import CanvasAnimation from '../../../abstract/canvas'
import FlyingPoints from '../../templates/FlyingPoints'

export default class Spiral extends CanvasAnimation {
	constructor (ctx, parameters) {
		super()
		this.properties = parameters.properties
		this.a = 2.6

		this.ctx = ctx
		this.particles = []
		this.sizes = {
			width: parameters.innerWidth - parameters.offset,
			height: parameters.innerHeight
		}

		this.isStarted = false
		this.colorOffset = 0

		this.positionX = this.sizes.width / 2
		this.positionY = this.sizes.height / 2

		this.particleColors =
			parameters.properties.particleColors &&
				parameters.properties.particleColors.length
				? parameters.properties.particleColors
				: generateColorsByCount(parameters.properties.generativeColorsCounts)

		this.color = this.properties.isMonochrome
			? this.monochrome
			: this.propsColors

		this.radius = Math.min(this.sizes.width, this.sizes.height) / 2
		this.maxParticles = this.properties.maxParticles || 100
		this.particleSpacing = 2 * Math.PI / this.maxParticles
		this.numArms = this.properties.numArms || 2
		this.preAngle = Math.PI / (this.numArms * this.maxParticles)

		this.drawLines = this.drawLinesWithoutAdding
		this.boundAnimate = this.loop.bind(this)
	}

	monochrome (i, opacity) {
		return `rgba(${i % 2 === 0 ? '0, 0, 0' : '255, 255, 255'}, ${opacity})`
	}

	propsColors (i, opacity) {
		return this.particleColors[
			(this.colorOffset + i) % this.particleColors.length
		].replace(/\d+(?=\)$)/, opacity)
	}

	reDrawBackground () {
		this.ctx.fillStyle = this.properties.bgColor
		this.ctx.fillRect(0, 0, this.sizes.width, this.sizes.height)
	}

	drawLinesWithoutAdding () {
		if (this.a > 2.9) this.back = true
		else if (this.a < 2.65) this.back = false

		for (let i = 0; i < this.particles.length; i++) {
			this.a += 0.999995 * (this.back ? 1 : -1)

			this.angle = this.particleSpacing * i + i * this.preAngle
			const distance = this.radius * (this.angle / (2 * Math.PI)) * 2

			this.particles[i].x = this.positionX + distance * Math.cos(this.angle * Math.exp(this.a)) * Math.sin(this.a)
			this.particles[i].y = this.positionY + distance * Math.cos(this.a) * (-1)

			const x1 = this.particles[i].x
			const y1 = this.particles[i].y

			for (let j = i + 1; j < this.particles.length; j++) {
				const x2 = this.particles[j].x
				const y2 = this.particles[j].y

				const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(3)

				if (length < this.properties.lineLength) {
					this.ctx.lineWidth = 0.5
					this.ctx.strokeStyle = this.color(i, 1 - length / this.properties.lineLength, x1)
					this.ctx.beginPath()
					this.ctx.moveTo(x1, y1)
					this.ctx.lineTo(x2, y2)
					this.ctx.stroke()
				}
			}
		}
	}

	loop () {
		this.reDrawBackground()
		this.drawLines()

		requestAnimationFrame(this.boundAnimate)
	}

	init () {
		this.particles = new FlyingPoints(
			this.sizes.width,
			this.sizes.height,
			this.properties,
			this.isParticleColors
		).particles

		if (this.properties.isStatic) {
			this.reDrawBackground()
			this.drawLines()
			return
		}

		this.isStarted = true
		this.loop()
	}

	reInit (x, y) {
		this.positionX = x
		this.positionY = y
	}

	clear () {
		cancelAnimationFrame(this.boundAnimate)
		this.particles = null
		delete this
	}
}
