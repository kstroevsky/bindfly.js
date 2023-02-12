import * as THREE from 'three'
import * as noise from 'noisejs'

import FlyingPointsGL from '../../templates/FlyingPointsGL'
import { getPositionGL } from '../../../utils/canvas-helpers'
import { RGBAToHexA, generateColorsByCount } from '../../../utils/color-helpers'

export default class FlyingCubesGL extends THREE.Object3D {
	constructor(renderer, camera, scene, parameters) {
		super()
		this.properties = {
			...parameters.properties,
			d: 1000,
			getPositionMethod: {
				x: getPositionGL,
				y: getPositionGL,
				z: getPositionGL
			}
		}

		this.renderer = renderer
		this.camera = camera
		this.scene = scene

		this.sizes = {
			width: parameters.innerWidth - parameters.offset,
			height: parameters.innerHeight
		}

		this.scaleSize = this.properties.innerWidth / (2 * Math.tan((camera.fov / 2) * (Math.PI / 180)))

		this.isStarted = false

		this.particles = []
		this.vertices = []
		this.lines = []
		this.cubes = []
		this.lineMaterial = null
		this.bodies = []

		this.lineGeometry = new THREE.BufferGeometry()
		this.lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1], 3))

		this.boundAnimate = this.loop.bind(this)
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

	map(value, min1, max1, min2, max2) {
		return min2 + (max2 - min2) * ((value - min1) / (max1 - min1))
	}

	mandelbrot() {
		const width = 1024
		const height = 1024
		const data = new Uint8Array(width * height * 4)

		const minRe = -1.3
		const maxRe = -1.2
		const minIm = 0
		const maxIm = 0.1
		const maxIter = 512

		const noiseScale = 0.01
		const noiseIntensity = 10

		const noiseGen = new noise.Noise()

		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				const re = this.map(x, 0, width, minRe, maxRe)
				const im = this.map(y, 0, height, minIm, maxIm)

				let zRe = re
				let zIm = im

				let iter = 0
				while (iter < maxIter && (zRe * zRe + zIm * zIm) <= 4) {
					const zRe2 = zRe * zRe
					const zIm2 = zIm * zIm
					zIm = 2 * zRe * zIm + im
					zRe = zRe2 - zIm2 + re
					iter++
				}

				// Use a hybrid coloring approach
				if (iter < maxIter) {
					// Color the pixel based on the number of iterations
					const hue = Math.floor((iter / maxIter) * 3600)
					const color = new THREE.Color().setHSL(hue / 360, 1, 0.5)
					data[x * 4 + y * width * 4] = color.r * 255
					data[x * 4 + y * width * 4 + 1] = color.g * 255
					data[x * 4 + y * width * 4 + 2] = color.b * 255
					data[x * 4 + y * width * 4 + 3] = Math.sin(iter) * 255
				} else {
					const color = this.map(iter, 0, maxIter, 0, 1) * Math.random()
					data[4 * (y * width + x) + 0] = color * 128
					data[4 * (y * width + x) + 1] = color * 0
					data[4 * (y * width + x) + 2] = color * 255
					data[4 * (y * width + x) + 3] =
						(Math.sin(noiseGen.perlin3(x * noiseScale, y * noiseScale, Math.sin(x) * noiseScale) * noiseIntensity) / Math.sin(x / y)) *
						100
				}
			}
		}

		const texture = new THREE.DataTexture(
			data, // the pixel data for the texture, as a Uint8Array
			width, // the width of the texture in pixels
			height, // the height of the texture in pixels
			THREE.RGBAFormat, // the format of the pixel data (RGBA in this case)
			THREE.UnsignedByteType, // the type of the pixel data (unsigned byte in this case)
			THREE.EquirectangularReflectionMapping, // the mapping method for the texture (UV mapping in this case)
			THREE.MirroredRepeatWrapping, // the wrapping method for the texture in the horizontal direction (repeat in this case)
			THREE.MirroredRepeatWrapping, // the wrapping method for the texture in the vertical direction (repeat in this case)
			THREE.NearestFilter, // the filtering method for the texture (nearest in this case)
			THREE.NearestMipMapNearestFilter, // the mipmapping method for the texture (nearest in this case)
			100
		)
		texture.needsUpdate = true

		return texture
	}

	mandelbrotSet() {
		const width = 256
		const height = 256
		const maxIterations = 250
		const xMin = -2.2
		const yMin = -1.5
		const pixelWidth = 0.005
		const pixelHeight = 0.005
		const data = new Uint8Array(width * height * 4)

		for (let i = 0; i < width; i++) {
			for (let j = 0; j < height; j++) {
				const x = xMin + i * pixelWidth
				const y = yMin + j * pixelHeight
				const realComponentOfResult = x
				const imaginaryComponentOfResult = y
				let r = 0
				let g = 0
				let b = 0
				let iterations = 0

				while (r * r + g * g + b * b < 4 && iterations < maxIterations) {
					const tempRealComponent = r * r - g * g - b * b + realComponentOfResult
					g = 2 * r * g + imaginaryComponentOfResult
					b = 2 * r * b + imaginaryComponentOfResult
					r = tempRealComponent

					iterations++
				}

				if (iterations < maxIterations) {
					// color the pixel using a different color mapping algorithm
					const hue = Math.floor((iterations / maxIterations) * 360)
					const color = new THREE.Color().setHSL(hue / 360, 1, 0.5)
					data[i * 4 + j * width * 4] = color.r * 255
					data[i * 4 + j * width * 4 + 1] = color.g * 255
					data[i * 4 + j * width * 4 + 2] = color.b * 255
					data[i * 4 + j * width * 4 + 3] = 255
				} else {
					// color the pixel black
					data[i * 4 + j * width * 4] = 0
					data[i * 4 + j * width * 4 + 1] = 0
					data[i * 4 + j * width * 4 + 2] = 0
					data[i * 4 + j * width * 4 + 3] = 255
				}
			}
		}

		// create the texture using the Mandelbrot set data
		const texture = new THREE.DataTexture(
			data, // the pixel data for the texture, as a Uint8Array
			width, // the width of the texture in pixels
			height, // the height of the texture in pixels
			THREE.RGBAFormat, // the format of the pixel data (RGBA in this case)
			THREE.UnsignedByteType, // the type of the pixel data (unsigned byte in this case)
			THREE.UVMapping, // the mapping method for the texture
			THREE.RepeatWrapping, // the wrapping method for the texture in the horizontal direction (repeat in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the vertical direction (repeat in this case)
			THREE.NearestFilter, // the filtering method for the texture (nearest in this case)
			THREE.NearestFilter // the mipmapping method for the texture (nearest in this case)
		)

		// set the texture to update whenever the canvas changes
		texture.needsUpdate = true

		return texture
	}

	texture3D() {
		const width = 128
		const height = 128
		const depth = 128

		// Create an array of pixel data for the 3D texture
		const data = new Uint8Array(width * height * depth * 4)

		// Iterate through the pixels and set their values
		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				for (let z = 0; z < depth; z++) {
					const distance = Math.sqrt(
						(x - width / 2) ** 2 +
						(y - height / 2) ** 2 +
						(z - depth / 2) ** 2
					)
					const fogAmount = Math.min(1, distance / (width / 2))
					data[4 * (z * width * height + y * width + x) + 0] = 255
					data[4 * (z * width * height + y * width + x) + 1] = 255
					data[4 * (z * width * height + y * width + x) + 2] = 255
					data[4 * (z * width * height + y * width + x) + 3] = 255 * (1 - fogAmount)
				}
			}
		}

		// Create the 3D texture using the pixel data and dimensions
		const texture = new THREE.DataTexture3D(
			data, // the pixel data for the texture, as a Uint8Array
			width, // the width of the texture in pixels
			height, // the height of the texture in pixels
			depth, // the depth of the texture in pixels
			THREE.RGBAFormat, // the format of the pixel data (RGBA in this case)
			THREE.UnsignedByteType, // the type of the pixel data (unsigned byte in this case)
			THREE.UVMapping, // the mapping method for the texture (UV mapping in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the horizontal direction (repeat in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the vertical direction (repeat in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the depth direction (repeat in this case)
			THREE.NearestFilter, // the filtering method for the texture (nearest in this case)
			THREE.NearestFilter // the mipmapping method for the texture (nearest in this case)
		)

		texture.needsUpdate = true

		return texture
	}

	generateNormalMap() {
		const width = 256
		const height = 256
		const depth = 256
		const noiseScale = 0.01
		const noiseIntensity = 10
		// Create an array to store the displacement values
		const data = new Float32Array(width * height * depth * 4)

		const noiseGen = new noise.Noise()

		// Generate the displacement values
		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				for (let z = 0; z < depth; z++) {
					// Generate noise values for the x, y, and z coordinates
					const nx = noiseGen.perlin3(x * noiseScale, y * noiseScale, z * noiseScale) * noiseIntensity
					const ny = noiseGen.perlin3(x * noiseScale, y * noiseScale, z * noiseScale) * noiseIntensity
					const nz = noiseGen.perlin3(x * noiseScale, y * noiseScale, z * noiseScale) * noiseIntensity

					// Set the normal map data
					data[4 * (x + y * width + z * width * height) + 0] = (nx + 1) * 128
					data[4 * (x + y * width + z * width * height) + 1] = (ny + 1) * 128
					data[4 * (x + y * width + z * width * height) + 2] = (nz + 1) * 128
					data[4 * (x + y * width + z * width * height) + 3] = 255
				}
			}
		}

		// Create a DataTexture3D from the displacement values
		const texture = new THREE.DataTexture(
			data, // the pixel data for the texture, as a Uint8Array
			width, // the width of the texture in pixels
			height, // the height of the texture in pixels
			THREE.RGBAFormat, // the format of the pixel data (RGBA in this case)
			THREE.UnsignedByteType, // the type of the pixel data (unsigned byte in this case)
			THREE.UVMapping, // the mapping method for the texture (UV mapping in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the horizontal direction (repeat in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the vertical direction (repeat in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the depth direction (repeat in this case)
			THREE.NearestMipmapLinearFilter, // the filtering method for the texture (nearest in this case)
			THREE.NearestMipmapLinearFilter // the mipmapping method for the texture (nearest in this case)
		)

		texture.needsUpdate = true

		return texture
	}

	generateDisplacementMap() {
		const width = 256
		const height = 256
		const depth = 256
		const noiseScale = 0.01
		const noiseIntensity = 10
		// Create an array to store the displacement values
		const data = new Float32Array(width * height * depth * 4)

		const noiseGen = new noise.Noise()

		// Generate the displacement values
		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				for (let z = 0; z < depth; z++) {
					// Generate a noise value using noisejs
					const noiseValue = noiseGen.perlin3(x * noiseScale, y * noiseScale, z * noiseScale) * noiseIntensity

					// Set the displacement value for the pixel
					data[4 * (x + y * width + z * width * height) + 0] = noiseValue
					data[4 * (x + y * width + z * width * height) + 1] = noiseValue
					data[4 * (x + y * width + z * width * height) + 2] = noiseValue
					data[4 * (x + y * width + z * width * height) + 3] = noiseValue
				}
			}
		}

		// Create a DataTexture3D from the displacement values
		const texture = new THREE.DataTexture(
			data, // the pixel data for the texture, as a Uint8Array
			width, // the width of the texture in pixels
			height, // the height of the texture in pixels
			THREE.RGBAFormat, // the format of the pixel data (RGBA in this case)
			THREE.UnsignedByteType, // the type of the pixel data (unsigned byte in this case)
			THREE.UVMapping, // the mapping method for the texture (UV mapping in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the horizontal direction (repeat in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the vertical direction (repeat in this case)
			THREE.RepeatWrapping, // the wrapping method for the texture in the depth direction (repeat in this case)
			THREE.LinearMipmapLinearFilter, // the filtering method for the texture (linear in this case)
			THREE.LinearMipmapLinearFilter, // the mipmapping method for the texture (linear in this case)
		)

		texture.needsUpdate = true

		return texture
	}

	refraction() {
		// define the colors and positions for the gradient
		const colors = [
			new THREE.Color(0xFF0000), // red
			new THREE.Color(0xFFFF00), // yellow
			new THREE.Color(0x00FF00), // green
			new THREE.Color(0x00FFFF), // cyan
			new THREE.Color(0x0000FF), // blue
			new THREE.Color(0xFF00FF), // magenta
			new THREE.Color(0xFF0000) // red
		]
		const positions = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1]

		const scene = new THREE.Scene()

		// Create a new camera
		const camera = new THREE.OrthographicCamera(
			-1, // left
			1, // right
			1, // top
			-1, // bottom
			0, // near
			1 // far
		)

		// Create a new renderer
		const renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		})
		renderer.setSize(256, 256) // set the size of the renderer to 256x256 pixels

		// create a RenderTarget for the gradient map
		const gradientMap = new THREE.WebGLRenderTarget(256, 256)

		const gradientShaderMaterial = new THREE.ShaderMaterial({
			uniforms: {
				color1: { value: new THREE.Color(0xff0000) }, // set the start color to red
				color2: { value: new THREE.Color(0x00ff00) } // set the end color to green
			},
			vertexShader: `
			  varying vec2 vUv;
		  
			  void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			  }
			`,
			fragmentShader: `
			  uniform vec3 color1; // the start color
			  uniform vec3 color2; // the end color
			  varying vec2 vUv;
		  
			  void main() {
				// Interpolate the colors based on the UV coordinates
				gl_FragColor = vec4(mix(color1, color2, vUv.x), 1.0);
			  }
			`
		})

		// render the gradient map by rendering a fullscreen quad using the ShaderMaterial
		const planeGeometry = new THREE.PlaneGeometry(2, 2)

		// Create a new mesh using the plane geometry and the gradient shader material
		const planeMesh = new THREE.Mesh(planeGeometry, gradientShaderMaterial)

		// Add the plane mesh to the scene
		scene.add(planeMesh)

		// Render the scene to the render target
		this.renderer.render(scene, camera, gradientMap)

		return gradientMap
	}

	loop() {
		this.vertices = []

		this.cubes.forEach((item, idx) => {
			const rot = Math.random() / 100
			item.rotation.x += rot
			item.rotation.y += rot

			this.particles[idx].position()
			item.position.x = this.particles[idx].x / this.particles[idx].w * 2
			item.position.y = this.particles[idx].y / this.particles[idx].h * 2
			item.position.z = this.particles[idx].z / this.particles[idx].d * 2
		})

		this.renderer.render(this.scene, this.camera)
		requestAnimationFrame(this.boundAnimate)
	}

	init() {
		this.particles = new FlyingPointsGL(
			this.sizes.width,
			this.sizes.height,
			this.properties
		).particles

		const baseLight = new THREE.AmbientLight(0xFFFFFF, 0.1)
		const light = new THREE.PointLight(0xffffff, 2, 1000)
		const light1 = new THREE.PointLight(0xffffff, 2, 1000)
		const light2 = new THREE.PointLight(0xffffff, 2, 1000)
		const pointLight = new THREE.PointLight(0xffffff, 2, 100)
		const pointLight2 = new THREE.PointLight(0xffffff, 2, 100)
		pointLight.position.set(5, 5, 5)
		pointLight2.position.set(-5, 5, 5)
		light.position.set(5, 0, 0)
		light1.position.set(0, 5, 0)
		light2.position.set(0, 0, 5)
		// this.scene.add(baseLight)
		this.scene.add(light)
		this.scene.add(light1)
		this.scene.add(light2)
		this.scene.add(pointLight)
		this.scene.add(pointLight2)
		// this.scene.fog = new THREE.Fog(0xffffff, 0, 750);

		this.raycaster = new THREE.Raycaster()
		this.mouse = new THREE.Vector2()
		this.texture = this.mandelbrot()

		this.refMap = this.refraction()
		this.normMap = this.refraction()
		this.disMap = this.refraction()

		const material = new THREE.ShaderMaterial({
			// color: 0xffffff, // set the color to white
			// blending: THREE.CustomBlending,
			// blendSrc: THREE.SrcAlphaFactor,
			// blendDst: THREE.OneMinusSrcAlphaFactor,
			// blendEquation: THREE.AddEquation,
			// side: THREE.DoubleSide,
			// displacementScale: 0.1,
			// normalScale: new THREE.Vector2(1, 1),
			// roughness: 0.0, // set the roughness to 0 to give it a smooth surface
			// metalness: 0.0, // set the metalness to 0 to make it non-metallic
			// clearcoat: 1.0, // set the clear coat to 1 to give it a glossy finish
			// clearcoatRoughness: 0.0, // set the clear coat roughness to 0 to give it a smooth finish
			// reflectivity: 1.0, // set the reflectivity to 1 to make it highly reflective
			// refractionRatio: 1.5, // set the refraction ratio to 1.5 to make it a realistic glass
			// transparent: true,
			// transparency: 0,
			// opacity: 0.2,
			// displacementMap: this.generateDisplacementMap(),
			// normalMap: this.generateNormalMap(),
			uniforms: {
				color: { value: new THREE.Color(0xffffff) }, // set the color to white
				blending: { value: THREE.CustomBlending },
				blendSrc: { value: THREE.SrcAlphaFactor },
				blendDst: { value: THREE.OneMinusSrcAlphaFactor },
				blendEquation: { value: THREE.AddEquation },
				side: { value: THREE.DoubleSide },
				displacementScale: { value: 0.1 },
				normalScale: { value: new THREE.Vector2(1, 1) },
				roughness: { value: 0.0 }, // set the roughness to 0 to give it a smooth surface
				metalness: { value: 1.0 }, // set the metalness to 0 to make it non-metallic
				clearcoat: { value: 1.0 }, // set the clear coat to 1 to give it a glossy finish
				clearcoatRoughness: { value: 0.0 }, // set the clear coat roughness to 0 to give it a smooth finish
				reflectivity: { value: 1.0 }, // set the reflectivity to 1 to make it highly reflective
				refractionRatio: { value: 1.5 }, // set the refraction ratio to 1.5 to make it a realistic glass
				transparent: { value: true },
				transparency: { value: 0.5 },
				opacity: { value: 0.2 },
				displacementMap: { value: this.generateDisplacementMap() },
				normalMap: { value: this.generateNormalMap() },
				refractiveIndex: { value: 1.5 }, // the refractive index of the material
				uLightDirection: { value: new THREE.Vector3() }, // the direction of the light source
				refractionMap: { value: this.refMap }
			},
			vertexShader: `
			  uniform vec3 color;
			  uniform float roughness;
			  uniform float metalness;
			  uniform float clearcoat;
			  uniform float clearcoatRoughness;
			  uniform float reflectivity;
			  uniform float refractionRatio;
			  uniform float displacementScale;
			  uniform float normalScale;
			  uniform float refractiveIndex;
			  varying vec3 vNormal;
			  varying vec3 vPosition;
			  varying vec3 uLightDirection;
			  varying vec2 vUv;

			  
			  void main() {
				vec3 lightDirection = normalize(uLightDirection);
				vPosition = position;
				vUv = uv;
			  
				// Scale the normal by the normalScale value
				vec3 norm = normal * normalScale;
				vNormal = norm;
			  
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			  }						  
			`,
			fragmentShader: `
			uniform vec3 color; // set the color to white
			uniform float roughness; // set the roughness to 0 to give it a smooth surface
			uniform float metalness; // set the metalness to 0 to make it non-metallic
			uniform float clearcoat; // set the clear coat to 1 to give it a glossy finish
			uniform float clearcoatRoughness; // set the clear coat roughness to 0 to give it a smooth finish
			uniform float reflectivity; // set the reflectivity to 1 to make it highly reflective
			uniform float refractionRatio; // set the refraction ratio to 1.5 to make it a realistic glass
			uniform float displacementScale; // the displacement scale of the material
			uniform float normalScale; // the normal scale of the material
			uniform float refractiveIndex; // the refractive index of the glass material
			varying vec3 vNormal; // the surface normal of the glass material
			varying vec3 vPosition; // the position of the fragment in world space
			varying vec3 uLightDirection; // the direction of the light source
			
			varying vec2 vUv;
			uniform sampler2D refractionMap;
			uniform sampler2D displacementMap; // the displacement map of the material
			uniform sampler2D normalMap; // the normal map of the material
			
			// calculate the Fresnel coefficient using the Fresnel equation
			float fresnel(float cosTheta, float refractiveIndex) {
			  float g = sqrt(pow(refractiveIndex - 1.0, 2.0) + pow(cosTheta, 2.0)) / sqrt(pow(refractiveIndex + 1.0, 2.0) + pow(cosTheta, 2.0));
			  return (pow(g - 1.0, 2.0) / pow(g + 1.0, 2.0));
			}
			
			void main() {
			  // calculate the angle of incidence and the Fresnel coefficient
			  float cosTheta = dot(-vNormal, uLightDirection);
			  float fresnelCoeff = fresnel(cosTheta, refractiveIndex);

			  // calculate the hue value based on the Fresnel coefficient
			  float hue = mod(fresnelCoeff * 360.0, 360.0);
			
			  // set the color of the fragment to a rainbow color based on the hue value
			  vec3 fragColor = vec3(hue / 360.0, 1.0, 0.5);
			
			  // apply the color, roughness, metalness, clear coat, clear coat roughness, and reflectivity to the fragment
			  fragColor = mix(color, fragColor, reflectivity);
			//   fragColor = mix(vec3(1.0 - roughness), fragColor, roughness);
			//   fragColor = mix(vec3(metalness), fragColor, metalness);
			//   fragColor = mix(vec3(clearcoat), fragColor, clearcoat);
			//   fragColor = mix(vec3(1.0 - clearcoatRoughness), fragColor, clearcoatRoughness);
			
			  // apply the displacement map and normal map to the fragment
			  vec4 displacement = texture2D(displacementMap, vUv);
			  vec3 displacedPosition = vPosition + normalize(vNormal) * displacement.r * displacementScale;
			  vec3 normal = texture2D(normalMap, vUv).rgb;
			  normal = normalize(normal * 2.0 - 1.0);
			  normal = normal * normalScale;
			  normal = normalize(normal);

			  // calculate the surface normal using the displacement map and normal map
			  vec3 surfaceNormal = mix(normal, texture2D(normalMap, vUv).rgb, displacementScale);
			  surfaceNormal = normalize(surfaceNormal);
			  
			  // calculate the hue value based on the surface normal
			  hue = mod(surfaceNormal.x * 360.0, 360.0);
			  
			  // set the color of the fragment to a rainbow color based on the hue value
			  vec3 color = vec3(hue / 360.0, 1.0, 0.5);
			  
			  // calculate the specular lighting using the Phong reflection model
			  vec3 specular = vec3(0.0);
			  vec3 viewDirection = normalize(cameraPosition - vPosition);
			  vec3 halfVector = normalize(uLightDirection + viewDirection);
			  float specularCoeff = pow(clamp(dot(surfaceNormal, halfVector), 0.0, 1.0), 128.0);
			  specular = specularCoeff * vec3(1.0);
			  
			  // calculate the diffuse lighting using the Lambertian reflection model
			  float diffuseCoeff = clamp(dot(surfaceNormal, uLightDirection), 0.0, 1.0);
			  vec3 diffuse = diffuseCoeff * vec3(1.0);
			  
			  // calculate the final color of the fragment
			  color = mix(color, specular, roughness);
			  color = mix(color, diffuse, 1.0 - roughness);
			  color = mix(color, vec3(1.0), metalness);
			  
			  // apply the clear coat to the fragment
			  color = mix(color, vec3(1.0), clearcoat);
			  
			  // apply the reflectivity to the fragment
			  color = mix(color, reflect(viewDirection, surfaceNormal), reflectivity);
			  
			  // apply the refraction to the fragment
			//   vec3 refraction = vec3(0.0);
			//   if (refractiveIndex > 0.0) {
				float eta = 1.0 / refractiveIndex;
				cosTheta = dot(viewDirection, surfaceNormal);
				vec3 refractionDirection = refract(viewDirection, surfaceNormal, eta);
				vec3 refraction = texture(refractionMap, vUv).rgb;
			//   }
			  color = mix(color, refraction, refractionRatio);
			  
			  // set the final color of the fragment
			  gl_FragColor = vec4(color, 1.0);
			}
			`
		})
		// const positions = new Float32Array([]);

		const texture3 = this.generateDisplacementMap()

		const count = 2

		for (let i = 0; i < count; i++) {
			const cubeObject = new THREE.Mesh(
				new THREE.SphereGeometry(count / 4),
				// material

				new THREE.MeshPhysicalMaterial({
					color: RGBAToHexA(generateColorsByCount(11)[Math.round(Math.random() * 10)]),
					side: THREE.DoubleSide,
					opacity: 1,
					// blending: THREE.AdditiveAnimationBlendMode,
					blending: THREE.CustomBlending,
					blendSrc: THREE.SrcAlphaSaturateFactor,
					blendDst: THREE.OneMinusDstColorFactor,
					blendEquation: THREE.AddEquation,
					roughness: 1,
					// ior: 0.9,
					sheen: 1,
					metalness: 1,
					reflectivity: 0.9,
					specularIntensity: 1,
					// fog: true,
					clearcoat: 1,
					// attenuationDistance: 1,
					defines: {
						MATERIAL: '1',
					},
					refractionRatio: 10,
					// transmission: 1,
					reflectivity: 1,
					transmissionMap: this.texture,
					transparent: false,
					// map: this.refMap,
					// transparency: 0.5,
					displacementScale: -0.05,
					// emissiveMap: this.texture,
					map: this.texture,
					normalMap: this.normMap,
					// bumpMap: this.refMap,
					// emissiveMap: this.texture,
					lightMap: this.refMap,
					// envMap: this.texture,
					metalnessMap: this.texture,
					roughnessMap: this.refMap,
					flatShading: true,
					depthTest: true,
					// displacementBias: 0.5,
					displacementMap: this.disMap,
					// refractionMap: this.refMap,
					// uniforms: {
					// 	refractiveIndex: { value: 1.5 }, // the refractive index of the material
					// },
					// vertexShader: `
					// 	varying vec3 vNormal;
					// 	varying vec3 vPosition;

					// 	void main() {
					// 	  vNormal = normal;
					// 	  vPosition = position;
					// 	  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					// 	}
					//   `,
					// fragmentShader: `
					// 	uniform float refractiveIndex;
					// 	varying vec3 vNormal;
					// 	varying vec3 vPosition;

					// 	// calculate the Fresnel coefficient using the Fresnel equation
					// 	float fresnel(float cosTheta, float refractiveIndex) {
					// 	  float g = sqrt(pow(refractiveIndex - 1.0, 2.0) + pow(cosTheta, 2.0)) / sqrt(pow(refractiveIndex + 1.0, 2.0) + pow(cosTheta, 2.0));
					// 	  return (pow(g - 1.0, 2.0) / pow(g + 1.0, 2.0));
					// 	}

					// 	void main() {
					// 	  // calculate the angle of incidence and the Fresnel coefficient
					// 	  float cosTheta = dot(-vNormal, normalize(vPosition));
					// 	  float fresnelCoeff = fresnel(cosTheta, refractiveIndex);

					// 	  // set the color of the fragment based on the Fresnel coefficient
					// 	  gl_FragColor = vec4(fresnelCoeff, fresnelCoeff, fresnelCoeff, 10.0);
					// 	}
					//   `
				})
			)
			cubeObject.mass = 1

			this.cubes.push(cubeObject)
			this.scene.add(cubeObject)
		}

		// window.addEventListener('mousemove', (event) => {
		// 	this.mouse.x = (event.pageX / this.sizes.width) * 2 - 1;
		// 	this.mouse.y = -(event.pageY / this.sizes.height) * 2 + 1;

		// 	this.raycaster.setFromCamera(this.mouse, this.camera);
		// 	const intersects = this.raycaster.intersectObjects(this.cubes);

		// 	if (intersects.length > 0) {
		// 		intersects.forEach(x => {
		// 			const data = x.object.material.map.source.data.data;

		// 			for (let i = 0; i < data.length; i += 4) {
		// 				data[i] = Math.random() * 255
		// 			}

		// 			// this.texture.source.data.data = data;
		// 			// this.texture.needsUpdate = true;

		// 			x.object.material.map.source.data.data = data
		// 			x.object.material.map.needsUpdate = true
		// 		})
		// 	}
		// });
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
