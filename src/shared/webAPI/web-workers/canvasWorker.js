import { canvasClickHandler } from '../../../utils'

let animationWorker = null;
let canvas, ctx;

// eslint-disable-next-line no-restricted-globals
self.onmessage = function (e) {
    switch (e.data.msg) {
        case 'init':
            canvas = e.data.canvas;
            ctx = canvas.getContext('2d', { alpha: false });
            canvas.width = e.data.animationParameters.innerWidth;
            canvas.height = e.data.animationParameters.innerHeight;

            import(`../../2d/animations/${e.data.animationName}`).then(cl => {
                animationWorker = new cl[e.data.animationName](ctx, e.data.animationParameters)
                animationWorker.init();
            });
            break;
        case 'click':
            canvasClickHandler(animationWorker, e);
            break;
        case 'stop':
        default:
            this.cancelAnimationFrame(this.canvasRafId)
            this.cancelAnimationFrame(this.timerRafId)
            this.close()
            return;
    }

    return;
}