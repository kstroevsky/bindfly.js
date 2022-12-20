// import { canvasClickHandler } from '../../utils/index.js';
// import FlyingLines from '../../2d/animations/FlyingLines/index.js';
// import { ICanvasWorkerProps } from '../../../hooks/useCanvas';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// import { ICanvasWorkerProps } = require('../../types');

import { ICanvasWorkerProps } from '../../types';

// export interface ICanvasWorkerProps {
// 	msg: 'init' | 'click' | 'stop';
// 	canvas: OffscreenCanvas;
// 	animationName: string;
// 	animationParameters: TAnimationProperties;
// }

interface IWorkerEvent {
	data: ICanvasWorkerProps;
}

let animationWorker: InstanceType<any> = null;
let animation: any,
	canvas: OffscreenCanvas,
	ctx: OffscreenCanvasRenderingContext2D,
	dpr: number,
	canvasClickHandler: (...args: any) => void;

// let animationWorker = null;
// let canvas, ctx, dpr;

// declare const self: DedicatedWorkerGlobalScope;
// export { };

// const self = globalThis as unknown as DedicatedWorkerGlobalScope;

self.onmessage = function (e: IWorkerEvent) {
	switch (e.data.msg) {
		case 'init':
			animation = require(`../../2d/animations/${e.data.animationName}`);
			({ canvasClickHandler } = require('../../utils'));

			canvas = e.data.canvas;
			dpr = e.data.animationParameters.devicePixelRatio;
			ctx = canvas.getContext('2d', {
				alpha: false
			}) as OffscreenCanvasRenderingContext2D;
			console.info('CONTEXT', ctx);

			canvas.width =
				(canvas.width !== e.data.animationParameters.innerWidth
					? canvas.width
					: e.data.animationParameters.innerWidth) * dpr;
			canvas.height =
				(canvas.height !== e.data.animationParameters.innerHeight
					? canvas.height
					: e.data.animationParameters.innerHeight) * dpr;

			ctx.scale(dpr, dpr);
			console.info('WORK', e.data.animationName);

			animationWorker = new animation.default(
				ctx,
				e.data.animationParameters,
				false
			);
			animationWorker.init();

			console.info('WORK', animationWorker);
			console.log(canvasClickHandler);

			break;

		case 'click':
			canvasClickHandler?.(animationWorker, e.data);

			break;

		case 'stop':
		default:
			console.log('close is not working now');
		// this.cancelAnimationFrame(this.canvasRafId);
		// this.cancelAnimationFrame(this.timerRafId);
		// this.close();
	}
};
