import React from "react";
import { canvasClickHandler } from '../../utils'

let animationWorker = null;
let canvas, ctx;

// eslint-disable-next-line no-restricted-globals
self.onmessage = function (e) {
    switch (e.data.msg) {
        case 'init':
            canvas = e.data.canvas;
            ctx = canvas.getContext('2d', { alpha: false });
            // console.log(ctx)
            // canvas.transferToImageBitmap();
            // ctx.reset()
            canvas.width = e.data.animationParameters.innerWidth;
            canvas.height = e.data.animationParameters.innerHeight;

            import(`../../components/canvas/animations/${e.data.animationName}`).then(cl => {
                animationWorker = new cl[e.data.animationName](ctx, e.data.animationParameters)
                animationWorker.init();
            });
            break;

        case 'click':
            canvasClickHandler(animationWorker, e);
            break;

        case 'stop':
        default:
            console.log('stop')
            // [this?.canvasRafId, this?.timerRafId].map(rafId => {
            //     if (rafId) {
            //         this.cancelAnimationFrame(rafId);
            //     }
            // });
            console.log(Object.keys(this))
            this.cancelAnimationFrame(animationWorker?.boundAnimate)
            this.close()
            animationWorker?.clear()
            animationWorker = undefined
            return;
    }

    if (e.data.msg === 'click') {
        canvasClickHandler(animationWorker, e)
    }

    return;
}