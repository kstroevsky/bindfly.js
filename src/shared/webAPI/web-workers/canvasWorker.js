import { canvasClickHandler } from '../../utils'

let animationWorker = null;
let canvas, ctx;

// eslint-disable-next-line no-restricted-globals
self.onmessage = function (e) {
    switch (e.data.msg) {
        case 'init':
            canvas = e.data.canvas;
            ctx = canvas.getContext('2d', { alpha: false })

            const { innerWidth, innerHeight } = e.data.animationParameters
            const { width, height } = canvas

            canvas.width = width !== innerWidth ? width : innerWidth
            canvas.height = height !== innerHeight ? height : innerHeight

            import(`../../2d/animations/${e.data.animationName}`).then(cl => {
                animationWorker = new cl[e.data.animationName](ctx, e.data.animationParameters, false)
                animationWorker.init();
            });
            break;
        case 'click':
            canvasClickHandler(animationWorker, e.data);
            break;
        case 'resize':
            this.cancelAnimationFrame(this.canvasRafId)
            this.cancelAnimationFrame(this.timerRafId)

            canvas.width = canvas.width !== e.data.sizes.innerWidth ? width : e.data.sizes.innerWidth
            canvas.height = canvas.height !== e.data.sizes.innerHeight ? height : e.data.sizes.innerHeight
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