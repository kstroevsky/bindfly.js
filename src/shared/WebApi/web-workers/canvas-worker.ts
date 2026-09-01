import { ECanvasWorkerMessage } from '../../constants'
import { changeAlpha } from '../../utils/color-helpers'
import {
	canvasParticlesCountChange,
	canvasResizeHandlerFactory,
	getVelocity,
} from '../../utils/canvas-helpers'

import type CanvasAnimation from '../../abstract/canvas'
import type { TConstructorOf, ICanvasWorkerProps, TCallable } from '../../types'

let canvas: OffscreenCanvas,
				ctx: OffscreenCanvasRenderingContext2D,
				dpr: number,
				canvasClickHandler: (...args: unknown[]) => void,
				Animation: TConstructorOf<CanvasAnimation>,
				animationWorker: InstanceType<TConstructorOf<CanvasAnimation>>,
				resizer: TCallable<void, UIEvent>

const self = globalThis as unknown as DedicatedWorkerGlobalScope

self.onmessage = async function (e: MessageEvent<ICanvasWorkerProps>) {
	switch (e.data.msg) {
		case ECanvasWorkerMessage.INIT:
			({ canvasClickHandler } = require('../../utils/canvas-helpers'));
			({ default: Animation } = await import(
				`../../2d/animations/${e.data.animationName}/index.js`
			))

			canvas = e.data.canvas
			dpr = e.data.animationParameters.devicePixelRatio
			ctx = canvas.getContext('2d', {
				alpha: false,
			}) as OffscreenCanvasRenderingContext2D

			canvas.width =
				(canvas.width !== e.data.animationParameters.innerWidth
					? canvas.width
					: e.data.animationParameters.innerWidth) * dpr
			canvas.height =
				(canvas.height !== e.data.animationParameters.innerHeight
					? canvas.height
					: e.data.animationParameters.innerHeight) * dpr

			ctx.scale(dpr, dpr)

			animationWorker = new Animation(ctx, e.data.animationParameters, false)
			animationWorker.init()

			resizer = canvasResizeHandlerFactory<typeof Animation>(canvas, animationWorker, ctx)

			break

		case ECanvasWorkerMessage.RESIZE:
			resizer(e.data.e)
			break

		case ECanvasWorkerMessage.CLICK:
			animationWorker && canvasClickHandler?.(animationWorker, e.data)

			break

		case ECanvasWorkerMessage.COUNT:
			animationWorker && canvasParticlesCountChange(e.data.count || 0, animationWorker)

			break

		case ECanvasWorkerMessage.RADIUS:
			if (animationWorker) animationWorker.spiralRadius = e.data.radius

			break

		case ECanvasWorkerMessage.VELOCITY:
			if (animationWorker) {
				animationWorker.properties.particleMaxVelocity = e.data.velocity || 0
				animationWorker.particles = animationWorker?.particles?.map((item) => {
					const newVelocity = getVelocity(e.data.velocity || 0)

					return {
						...item,
						velocityX: newVelocity,
						velocityY: newVelocity,
					}
				})
			}

			break

		case ECanvasWorkerMessage.LENGTH:
			if (animationWorker) animationWorker.properties.lineLength = e.data.lineLength || 0

			break

		case ECanvasWorkerMessage.WEIGHT:
			if (animationWorker) animationWorker.properties.weight = e.data.weight || 0

			break

		case ECanvasWorkerMessage.ALPHA:
			if (animationWorker) {
				animationWorker.properties.bgColor = changeAlpha(
					animationWorker.properties.bgColor,
					e.data.bgAlpha || 0
				)
			}

			break

		case ECanvasWorkerMessage.STOP:
		default:
			animationWorker && close()
	}
}
