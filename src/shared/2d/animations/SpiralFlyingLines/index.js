import { generateColorsByCount } from '../../../utils/color-helpers'
import CanvasAnimation from '../../../abstract/canvas'
import FlyingPoints from '../../templates/FlyingPoints'

export default class SpiralFlyingLines extends CanvasAnimation {
	constructor (ctx, parameters) {
		super()
		this.properties = parameters.properties

		this.ctx = ctx
		this.particles = []
		this.currentIntersected = 0
		this.sizes = {
			width: parameters.innerWidth - parameters.offset,
			height: parameters.innerHeight
		}

		this.isStarted = false
		this.colorOffset = 0

		this.spiralRadius = this.properties.radius || 0 // Add a variable to track the radius of the spiral
		this.spiralAngle = 0 // Add a variable to track the angle of the spiral

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

		this.drawLines = this.drawLinesWithoutAdding

		this.reCalculateSpiral = this.properties.reverse
			? () => this.decreaseAngle() || this.properties.radius || this.decreaseRadius()
			: () => this.increaseAngle() || this.properties.radius || this.increaseRadius()

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

	increaseAngle () {
		this.spiralAngle += 0.1 // Increase the angle of the spiral
	}

	decreaseAngle () {
		this.spiralAngle -= 0.1 // Increase the angle of the spiral
	}

	increaseRadius () {
		this.spiralRadius += 0.05 // Increase the radius of the spiral
	}

	decreaseRadius () {
		this.spiralRadius -= 0.05 // Increase the radius of the spiral
	}

	drawLinesWithoutAdding () {
		let x1, y1, x2, y2

		for (const i in this.particles) {
			// Modify the position of the particle to follow a spiral pattern
			this.particles[i].x = this.positionX + this.spiralRadius * Math.cos(this.spiralAngle * 0.5)
			this.particles[i].y = this.positionY + this.spiralRadius * Math.sin(this.spiralAngle * 0.5)
			this.reCalculateSpiral()

			x1 = this.particles[i].x
			y1 = this.particles[i].y

			for (const j in this.particles) {
				if (j % 2 === 0) {
					x2 = this.particles[j].x
					y2 = this.particles[j].y
					this.ctx.strokeStyle = this.color(
						i,
						Math.random(),
						j
					)
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
			this.properties
		).particles

		if (this.properties.isStatic) {
			this.reDrawBackground()
			this.drawLines()
			return
		}

		this.isStarted = true

		setInterval(() => {
			if (this.properties.isPulsative) {
				if (this.spiralRadius > this.sizes.width * 6) {
					this.reCalculateSpiral =
						() => this.decreaseAngle() || this.decreaseRadius()
				} else if (this.spiralRadius < 10) {
					this.reCalculateSpiral =
						() => this.increaseAngle() || this.properties.radius || this.increaseRadius()
				}
			}

			this.particles.push(
				{ ...this.particles[0], x: this.sizes.width / 2, y: this.sizes.height / 2 },
				{ ...this.particles[1], x: this.sizes.width / 2, y: this.sizes.height / 2 },
				{ ...this.particles[2], x: this.sizes.width / 2, y: this.sizes.height / 2 },
				{ ...this.particles[2], x: this.sizes.width / 2, y: this.sizes.height / 2 }
			)
		}, 20000)

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
