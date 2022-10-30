import React from "react";
let animationWorker = null;
let canvas, ctx;

// eslint-disable-next-line no-restricted-globals
self.onmessage = function(e) {
    if (e.data.msg === 'init') {
        canvas = e.data.canvas;
        
        ctx = canvas.getContext('2d', { alpha: false });
        canvas.width = e.data.animationParameters.innerWidth;
        canvas.height = e.data.animationParameters.innerHeight;
        
        import(`./animations/${e.data.animationName}`).then(cl => {
            animationWorker = new cl[e.data.animationName](ctx, e.data.animationParameters)
            animationWorker.init();
        });
        
    }

    if (e.data.msg === 'click') animationWorker && ((animationWorker.properties.addByClick 
        && (animationWorker.particles.shift()) && animationWorker.particles.push(
            {
                x: e.data.pos.x,
                y: e.data.pos.y,
                velocityX: animationWorker.particles[0].velocityX,
                velocityY: animationWorker.particles[0].velocityX,
                life: Math.random()*animationWorker.properties.particleLife*60,
                isStart: true,
                start: 0,
                position: animationWorker.particles[0].position,
                reCalculateLife: animationWorker.particles[0].reCalculateLife,
                calcColor: animationWorker.particles[0].calcColor,
                getColor: animationWorker.particles[0].getColor
            }
        ) && animationWorker.properties.isCountStable && animationWorker.particles.shift()) 
            || (animationWorker.properties.switchByClick 
                && animationWorker.properties.particleColors ?
                animationWorker.particles.push(animationWorker.particles.shift())
                : animationWorker.particles.sort((a, b) => 0.5 - Math.random())
            )
        )

    return;
}