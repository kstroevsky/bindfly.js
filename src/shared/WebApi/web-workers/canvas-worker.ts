import CanvasAnimation from '../../abstract/canvas';
import type { ConstructorOf, ICanvasWorkerProps } from '../../types';
import { canvasParticlesCountChange, getVelocity } from '../../utils';
import {TSomeAbstractClass} from "../../types";

let canvas: OffscreenCanvas,
	ctx: OffscreenCanvasRenderingContext2D,
	dpr: number,
	canvasClickHandler: (...args: unknown[]) => void,
	Animation: TSomeAbstractClass<CanvasAnimation>,
	animationWorker: InstanceType<ConstructorOf<CanvasAnimation>>;

const self = globalThis as unknown as DedicatedWorkerGlobalScope;

self.onmessage = async function (e: MessageEvent<ICanvasWorkerProps>) {
	switch (e.data.msg) {
		case 'init':
			({ canvasClickHandler } = require('../../utils'));
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

		case 'click':
			canvasClickHandler?.(animationWorker, e.data);

			break;

		case 'count':
			canvasParticlesCountChange(e.data.count || 0, animationWorker);

			break;

		case 'radius':
			animationWorker.spiralRadius = e.data.radius;

			break;

		case 'velocity':
			animationWorker.properties.particleMaxVelocity = e.data.velocity;
			animationWorker.particles = animationWorker?.particles?.map((item) => {
				const newVelocity = getVelocity(e.data.velocity || 0);
				return {
					...item,
					velocityX: newVelocity,
					velocityY: newVelocity,
				};
			});

			break;

		case 'lineLength':
			animationWorker.properties.lineLength = e.data.lineLength;

			break;

		case 'stop':
		default:
			animationWorker && close();
	}
};
