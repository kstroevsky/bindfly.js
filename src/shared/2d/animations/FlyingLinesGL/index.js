import * as THREE from 'three'

import FlyingPointsGL from '../../templates/FlyingPointsGL'
import { getPositionGL, getPosition } from '../../../utils/canvas-helpers'
import { RGBAToHexA, generateColorsByCount } from '../../../utils/color-helpers'

export default class FlyingLinesGL extends THREE.Object3D {
	constructor(renderer, camera, scene, parameters) {
		super()
		this.properties = {
			...parameters.properties,
			lineLength: parameters.properties.lineLength * (window.innerWidth / (5 * parameters.properties.lineLength)),
			d: 60,
			getPositionMethod: {
				x: getPositionGL,
				y: getPositionGL,
				z: parameters.properties.isPulsative ? getPositionGL : getPosition
			}
		}

		this.renderer = renderer
		this.camera = camera
		this.scene = scene

		this.sizes = {
			width: parameters.innerWidth - parameters.offset,
			height: parameters.innerHeight
		}

		// this.scaleSize = this.properties.innerWidth / (2 * Math.tan((camera.fov / 2) * (Math.PI / 180)))

		this.isStarted = false

		this.particles = []
		this.vertices = []
		this.lines = []
		this.cubes = []
		this.lineMaterial = null

		this.lineGeometry = new THREE.BufferGeometry()
		this.boundCube = this.loop.bind(this)
	}

	drawLines() {
		let x1, y1, z1, x2, y2, z2, length

		for (const i in this.particles) {
			this.particles[i].position()
			x1 = this.particles[i].x
			y1 = this.particles[i].y
			z1 = this.particles[i].z

			for (const j in this.particles) {
				x2 = this.particles[j].x
				y2 = this.particles[j].y
				z2 = this.particles[j].z
				length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)).toFixed(3)

				if (length < this.properties.lineLength) {
					const idx = +i + +j
					// const positions = this.scene.children[idx].geometry.attributes.position.array;
					this.scene.children[idx].position.x = x1
					this.scene.children[idx].position.y = y1
					this.scene.children[idx].position.z = z1
					// positions[0] = x1;
					// positions[1] = y1;
					// positions[2] = z1;
					// positions[3] = x2;
					// positions[4] = y2;
					// positions[5] = z2;

					// this.scene.children[idx].geometry.setAttribute('position', new THREE.Float64BufferAttribute(positions, 3));
				}
			}
		}
	}

	texture() {
		const width = 256
		const height = 256

		const data = new Uint8Array(width * height * 4)
		for (let i = 0; i < width; i++) {
			for (let j = 0; j < height; j++) {
				const x = i - width / 2
				const y = j - height / 2
				const distance = Math.sqrt(x * x + y * y)
				const angle = Math.atan2(y, x)
				const value = (angle + distance / 10) * 255 / (Math.PI * 2)
				const offset = (i + j * width) * 4
				data[offset] = value
				data[offset + 1] = value
				data[offset + 2] = value
				data[offset + 3] = 255
			}
		}

		const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType, THREE.UVMapping,
			THREE.RepeatWrapping, THREE.RepeatWrapping, THREE.LinearFilter, THREE.LinearFilter)
		texture.needsUpdate = true

		return texture
	}

	loop() {
		let x1, x2, y1, y2, z1, z2, length
		this.vertices = []

		this.particles.forEach((_, i) => {
			this.particles[i].position()

			x1 = this.particles[i].x / this.particles[i].w * 3
			y1 = this.particles[i].y / this.particles[i].h * 3
			z1 = this.particles[i].z / this.particles[i].d * 3

			for (let j = i + 1; j < this.particles.length; j++) {
				x2 = this.particles[j].x / this.particles[j].w * 3
				y2 = this.particles[j].y / this.particles[j].h * 3
				z2 = this.particles[j].z / this.particles[j].d * 3

				length = Math.sqrt(
					Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2)
				).toFixed(3)

				if (length < this.properties.lineLength / this.sizes.width * 2) {
					this.vertices.push(x1, y1, z1, x2, y2, z2)
				}
			}
		})

		this.lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(this.vertices, 3))
		this.lineMaterial.uniforms.time.value = performance.now() / 1000
		this.renderer.render(this.scene, this.camera)
		requestAnimationFrame(this.boundCube)
	}

	init() {
		this.particles = new FlyingPointsGL(
			this.sizes.width,
			this.sizes.height,
			this.properties,
		).particles

		for (let i = 0; i < this.particles.length; i++) {
			for (let j = i + 1; j < this.particles.length; j++) {
				this.vertices.push(this.particles[i].x, this.particles[i].y, this.particles[i].z)
				this.vertices.push(this.particles[j].x, this.particles[j].y, this.particles[j].z)
			}
		}

		this.lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(this.vertices, 3))

		this.lineMaterial = new THREE.ShaderMaterial({
			uniforms: {
				color: { value: new THREE.Color(RGBAToHexA(generateColorsByCount(1)[0])) },
				glowColor: { value: new THREE.Color(0xff0800) },
				time: { value: 1.0 },
				fogColor: { value: new THREE.Color(0x000) },
				fogNear: { value: 0.015 },
				fogFar: { value: 2 },
			},
			linewidth: 10,
			blending: THREE.AdditiveBlending,
			vertexShader: `
				varying vec3 vPosition;
			
				varying vec3 vColor;
				uniform float time;

				varying float fogDepth;
			
				void main() {
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					vPosition = position;
					vColor = vec3(fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453), fract(sin(dot(position.yz, vec2(12.9898, 78.233))) * 43758.5453), fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453));
					fogDepth = -vPosition.z;
				}
			`,
			fragmentShader: `
			  uniform vec3 color;
			  varying vec3 vColor;
			  uniform vec3 glowColor;
			  uniform float time;

			  varying float fogDepth;
			  uniform vec3 fogColor;
			  uniform float fogFar;
			  uniform float fogNear;
		  
			  void main() {
				vec3 finalColor = vColor;
				float fogFactor = smoothstep(fogNear, fogFar, fogDepth);
				finalColor += glowColor * (1.0 * sin(time * fogFar));
				gl_FragColor = vec4(mix(finalColor, mix(glowColor, fogColor, fogFactor), fogFactor ), 1.0);
			  }
			`,
		})

		this.lineMaterial.needsUpdate = true

		const line = new THREE.LineSegments(this.lineGeometry, this.lineMaterial)

		this.lines.push(line)

		// Add the lines to the scene
		this.lines.forEach((line) => {
			this.scene.add(line)
		})

		this.isStarted = true
		this.loop()
	}

	clear() {
		if (this.isStarted) {
			this.isStarted = false
			cancelAnimationFrame(this.boundAnimate)
		}
	}
}
