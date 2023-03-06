import { generateColorsByCount } from '../../../utils/color-helpers'
import CanvasAnimation from '../../../abstract/canvas'
import FlyingPoints from '../../templates/FlyingPoints'

export default class Pulse extends CanvasAnimation {
	constructor(ctx, parameters) {
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

		this.drawLines = this.drawLinesWithoutAdding
		// ? this.drawLinesWithAdding
		// : this.drawLinesWithoutAdding

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

	// drawLinesWithoutAdding() {
	// 	// Set up some constants for the spiral galaxy pattern
	// 	const centerX = this.sizes.width / 2;
	// 	const centerY = this.sizes.height / 2;
	// 	const radius = Math.min(this.sizes.width, this.sizes.height) / 2;
	// 	const maxParticles = this.properties.maxParticles || 100;
	// 	const particleSpacing = 2 * Math.PI / maxParticles;
	// 	const numArms = this.properties.numArms || 2;
	// 	const speed = this.properties.speed || 0.01;

	// 	// Calculate the current time in seconds
	// 	const time = Date.now() / 1000;

	// 	// Iterate through the particles and calculate their positions
	// 	  // Iterate through the particles and calculate their positions
	// 	  for (let i = 0; i < this.particles.length; i++) {
	// 		// Calculate the angle and distance from the center of the spiral
	// 		const arm = Math.floor(i / maxParticles);
	// 		let angle = particleSpacing * i + arm * Math.PI / numArms + time * speed;

	// 		// Make the angle cyclic by wrapping it back around to 0 once it exceeds 2 * pi
	// 		angle %= 2 * Math.PI;

	// 		const distance = radius * (1 - angle / (2 * Math.PI));

	// 		// Calculate the x and y position of the particle
	// 		const x = centerX + distance * Math.cos(angle);
	// 		const y = centerY + distance * Math.sin(angle);

	// 		// Update the particle's position
	// 		this.particles[i].x = x;
	// 		this.particles[i].y = y;
	// 	  }

	// 	  // Iterate through the particles again and draw the lines between them
	// 	  for (let i = 0; i < this.particles.length; i++) {
	// 		// Get the current particle's position
	// 		const x1 = this.particles[i].x;
	// 		const y1 = this.particles[i].y;

	// 		// Iterate through all the other particles and draw a line between them if they are close enough
	// 		for (let j = i + 1; j < this.particles.length; j++) {
	// 		  // Get the other particle's position
	// 		  const x2 = this.particles[j].x;
	// 		  const y2 = this.particles[j].y;

	// 		  // Calculate the distance between the two particles
	// 		  const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(3);

	// 		  // Draw a line between the two particles if they are close enough
	// 		  if (length < this.properties.lineLength) {
	// 			this.ctx.lineWidth = 0.5;
	// 			this.ctx.strokeStyle = this.color(i, 1 - length / this.properties.lineLength, x1);
	// 			this.ctx.beginPath();
	// 			this.ctx.moveTo(x1, y1);
	// 			this.ctx.lineTo(x2, y2);
	// 			this.ctx.stroke();
	// 		  }
	// 		}
	// 	  }
	// 	}

	drawLinesWithoutAdding() {
		// Set up some constants for the spiral galaxy pattern
		const radius = Math.min(this.sizes.width, this.sizes.height) / 2
		const maxParticles = this.properties.maxParticles || 100
		const particleSpacing = 2 * Math.PI / maxParticles
		const numArms = this.properties.numArms || 2

		if (this.a > 2.9) this.back = true
		if (this.a < 2.65) this.back = false

		// Iterate through the particles and calculate their positions
		for (let i = 0; i < this.particles.length; i++) {
			this.a += this.back ? 1 : -1
			if (this.back) this.a -= 0.000005
			else this.a += 0.000005
			// Calculate the angle and distance from the center of the spiral
			const arm = Math.floor(i / maxParticles)
			this.angle = (particleSpacing * i + arm * Math.PI / numArms)
			//   this.angle %= 2 * Math.PI;
			const distance = radius * (this.angle / (2 * Math.PI)) * 2

			// Calculate the x and y position of the particle
			const y = this.positionX + Math.tan(distance) * this.properties.weight * Math.cos(this.angle * Math.exp(this.a)) * Math.atan(this.a)
			const x = this.positionY + distance * Math.cos(this.a) * (-1)

			// Update the particle's position
			this.particles[i].x = x
			this.particles[i].y = y
		}

		// Iterate through the particles again and draw the lines between them
		for (let i = 0; i < this.particles.length; i++) {
			// Get the current particle's position
			const x1 = this.particles[i].x
			const y1 = this.particles[i].y

			// Iterate through all the other particles and draw a line between them if they are close enough
			for (let j = i + 1; j < this.particles.length; j++) {
				// Get the other particle's position
				const x2 = this.particles[j].x
				const y2 = this.particles[j].y

				// Calculate the distance between the two particles
				const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(3)

				// Draw a line between the two particles if they are close enough
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

	drawLinesWithAdding() {
		let x1, y1, x2, y2, length, opacity

		for (const i in this.particles) {
			this.particles[i].reCalculateLife()
			this.particles[i].position()

			x1 = this.particles[i].x
			y1 = this.particles[i].y

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

	reInit(x, y) {
		// cancelAnimationFrame(this.boundAnimate)
		this.positionX = x
		this.positionY = y
	}

	clear() {
		cancelAnimationFrame(this.boundAnimate)
		this.particles = null
		delete this
	}
}
