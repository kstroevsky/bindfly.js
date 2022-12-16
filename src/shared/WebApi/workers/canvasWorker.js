import { canvasClickHandler } from '../../utils';

let animationWorker = null;
let canvas, ctx, dpr;

// eslint-disable-next-line no-restricted-globals
self.onmessage = function (e) {
	switch (e.data.msg) {
		case 'init':
			{
				canvas = e.data.canvas;
				dpr = e.data.animationParameters.devicePixelRatio;
				ctx = canvas.getContext('2d', { alpha: false });

				const { innerWidth, innerHeight } = e.data.animationParameters;
				const { width, height } = canvas;

				canvas.width = (width !== innerWidth ? width : innerWidth) * dpr;
				canvas.height = (height !== innerHeight ? height : innerHeight) * dpr;
				ctx.scale(dpr, dpr);

				import(`../../2d/animations/${e.data.animationName}`).then((cl) => {
					animationWorker = new cl.default(ctx, e.data.animationParameters, false);
					animationWorker.init();
				});
			}
			break;
		case 'click':
			canvasClickHandler(animationWorker, e.data);
			break;
		case 'stop':
		default:
			this.cancelAnimationFrame(this.canvasRafId);
			this.cancelAnimationFrame(this.timerRafId);
			this.close();
	}
};
