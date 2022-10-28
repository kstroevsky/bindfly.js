import React from "react";
let animationWorker = null;
let canvas, ctx;

// eslint-disable-next-line no-restricted-globals
self.onmessage = function(e) {
    if (e.data.msg === 'init') {
        canvas = e.data.canvas;
        ctx = canvas.getContext('2d');
        canvas.width = e.data.animationParameters.innerWidth;
        canvas.height = e.data.animationParameters.innerHeight;

        import(`./animations/${e.data.animationName}`).then(cl => {
            animationWorker = new cl[e.data.animationName](ctx, e.data.animationParameters)
            animationWorker.init();
            animationWorker.loop();
        });

    }

    return;
}