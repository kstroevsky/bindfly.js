import { generateColorsByCount } from '../../../utils/color-helpers'
import CanvasAnimation from '../../../abstract/canvas'
import FlyingPoints from '../../templates/FlyingPoints'

export default class DroopingLines extends CanvasAnimation {
	constructor(ctx, parameters) {
		super()
		this.properties = parameters.properties

		this.ctx = ctx
		this.particles = []
		this.sizes = {
			width: parameters.innerWidth - parameters.offset,
			height: parameters.innerHeight
		}

		this.isStarted = false
		this.colorOffset = 0

		this.particleColors =
			parameters.properties.particleColors &&
				parameters.properties.particleColors.length
				? parameters.properties.particleColors
				: generateColorsByCount(parameters.properties.generativeColorsCounts)

		this.color = this.properties.isMonochrome
			? this.monochrome
			: this.propsColors

		this.drawLines = this.properties.addByClick
			? this.drawLinesWithAdding
			: this.drawLinesWithoutAdding

		this.boundAnimate = this.loop.bind(this)
	}

	monochrome(i, opacity) {
		return `rgba(${i % 2 === 0 ? '0, 0, 0' : '255, 255, 255'}, ${opacity})`
	}

	propsColors(i, opacity) {
		return this.particleColors[
			(this.colorOffset + i) % this.particleColors.length
		].replace(/\d+(?=\)$)/, opacity)
	}

	reDrawBackground() {
		this.ctx.fillStyle = this.properties.bgColor
		this.ctx.fillRect(0, 0, this.sizes.width, this.sizes.height)
	}

	drawLinesWithoutAdding() {
		let x1, y1, x2, y2, length

		for (const i in this.particles) {
			this.particles[i].reCalculateLife()
			this.particles[i].position()

			x1 = Math.tan(this.particles[i].x)
			y1 = this.particles[i].y

			for (const j in this.particles) {
				x2 = this.particles[j].x
				y2 = this.particles[j].y

				length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(3)

				if (length < this.properties.lineLength) {
					this.ctx.lineWidth = 0.5
					this.ctx.strokeStyle = this.color(
						i,
						1 - length / this.properties.lineLength,
						x1
					)

					this.ctx.beginPath()
					this.ctx.moveTo(x1, y1)
					this.ctx.lineTo(x2, y2)
					this.ctx.stroke()
				}
			}
		}
	}

	drawLinesWithAdding() {
		let x1, y1, x2, y2, length, opacity

		for (const i in this.particles) {
			this.particles[i].reCalculateLife()
			this.particles[i].position()

			x1 = this.particles[i].x
			y1 = Math.atan(this.particles[i].y)

			for (const j in this.particles) {
				x2 = this.particles[j].x
				y2 = this.particles[j].y

				length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(3)

				if (length < this.properties.lineLength) {
					opacity = 1 - length / this.properties.lineLength

					if (this.particles[i].isStart) {
						if (this.particles[i].start > opacity) {
							this.particles[i].isStart = false
						}

						opacity = this.particles[i].start
					}

					this.ctx.lineWidth = 0.5
					this.ctx.strokeStyle = this.color(i, opacity, x1)

					this.ctx.beginPath()
					this.ctx.moveTo(x1, y1)
					this.ctx.lineTo(x2, y2)
					this.ctx.stroke()
				}
			}
		}
	}

	loop() {
		this.reDrawBackground()
		this.drawLines()

		requestAnimationFrame(this.boundAnimate)
	}

	init() {
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

	clear() {
		cancelAnimationFrame(this.boundAnimate)
		this.particles = null
		delete this
	}
}
