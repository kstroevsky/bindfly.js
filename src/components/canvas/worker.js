import {Particles} from "./Particles";

let animationWorker = null;
let canvas, ctx;

// eslint-disable-next-line no-restricted-globals
self.onmessage = function(e) {
    if (e.data.msg === 'init') {

        canvas = e.data.canvas;
        ctx = canvas && canvas.getContext('2d');
        canvas.width = e.data.animationParameters.innerWidth;
        canvas.height = e.data.animationParameters.innerHeight;

        animationWorker = new Particles(ctx, e.data.animationParameters)
        animationWorker.init();
        animationWorker.loop();
    }

    return;
}