import { ECanvasWorkerMessage } from '../../constants';
import { changeAlpha } from '../../utils/color-helpers';
import {
	canvasParticlesCountChange,
	getVelocity,
} from '../../utils/canvas-helpers';

import type CanvasAnimation from '../../abstract/canvas';
import type { TConstructorOf, ICanvasWorkerProps } from '../../types';

let canvas: OffscreenCanvas,
	ctx: OffscreenCanvasRenderingContext2D,
	dpr: number,
	canvasClickHandler: (...args: unknown[]) => void,
	Animation: TConstructorOf<CanvasAnimation>,
	animationWorker: InstanceType<TConstructorOf<CanvasAnimation>>;

const self = globalThis as unknown as DedicatedWorkerGlobalScope;

self.onmessage = async function (e: MessageEvent<ICanvasWorkerProps>) {
	switch (e.data.msg) {
		case ECanvasWorkerMessage.INIT:
			({ canvasClickHandler } = require('../../utils/canvas-helpers'));
			({ default: Animation } = await import(
				`../../2d/animations/${e.data.animationName}/index.js`
			));

			canvas = e.data.canvas;
			dpr = e.data.animationParameters.devicePixelRatio;
			ctx = canvas.getContext('2d', {
				alpha: false,
			}) as OffscreenCanvasRenderingContext2D;

			canvas.width =
				(canvas.width !== e.data.animationParameters.innerWidth
					? canvas.width
					: e.data.animationParameters.innerWidth) * dpr;
			canvas.height =
				(canvas.height !== e.data.animationParameters.innerHeight
					? canvas.height
					: e.data.animationParameters.innerHeight) * dpr;

			ctx.scale(dpr, dpr);

			animationWorker = new Animation(ctx, e.data.animationParameters, false);
			animationWorker.init();

			break;

		case ECanvasWorkerMessage.CLICK:
			canvasClickHandler?.(animationWorker, e.data);

			break;

		case ECanvasWorkerMessage.COUNT:
			canvasParticlesCountChange(e.data.count || 0, animationWorker);

			break;

		case ECanvasWorkerMessage.RADIUS:
			animationWorker.spiralRadius = e.data.radius;

			break;

		case ECanvasWorkerMessage.VELOCITY:
			animationWorker.properties.particleMaxVelocity = e.data.velocity || 0;
			animationWorker.particles = animationWorker?.particles?.map((item) => {
				const newVelocity = getVelocity(e.data.velocity || 0);
				return {
					...item,
					velocityX: newVelocity,
					velocityY: newVelocity,
				};
			});

			break;

		case ECanvasWorkerMessage.LENGTH:
			animationWorker.properties.lineLength = e.data.lineLength || 0;

			break;

		case ECanvasWorkerMessage.WEIGHT:
			animationWorker.properties.weight = e.data.weight || 0;

			break;

		case ECanvasWorkerMessage.ALPHA:
			animationWorker.properties.bgColor = changeAlpha(
				animationWorker.properties.bgColor,
				e.data.bgAlpha || 0
			);

			break;

		case ECanvasWorkerMessage.STOP:
		default:
			animationWorker && close();
	}
};
