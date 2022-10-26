import {Particles} from "./Particles";

let animationWorker = null;
let canvas, ctx;

// eslint-disable-next-line no-restricted-globals
self.onmessage = function(e) {
    if (e.data.msg === 'init') {
        canvas = e.data.canvas;
        canvas.width = e.data.innerWidth;
        canvas.height = e.data.innerHeight;

        ctx = canvas.getContext('2d');

        animationWorker = new Particles(ctx, e.data.properties, e.data.particles, e.data.innerWidth, e.data.innerHeight)
        animationWorker.init();
        animationWorker.loop();
    }

    return;
}