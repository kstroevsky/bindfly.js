import React, {useEffect, useRef} from "react";

export const useAnimation = (Animation, animationParameters) => {
    const workerRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../components/canvas/worker.js', import.meta.url));

        if (canvasRef){
            try {
                if (animationParameters.properties.addByClick || animationParameters.properties.switchByClick) document.addEventListener('click', e => {
                    workerRef.current.postMessage({
                        msg: 'click',
                        pos: {x: e.clientX, y: e.clientY}
                    })
                })

                const offscreen = canvasRef.current.transferControlToOffscreen();

                workerRef.current.postMessage(
                    {
                        msg: 'init',
                        canvas: offscreen,
                        animationName: Animation.name,
                        animationParameters: animationParameters
                    },
                    [offscreen]
                );
            } catch {
                const canvas = canvasRef.current
                const ctx = canvas.getContext('2d', { alpha: false });

                canvas.width = animationParameters.innerWidth;
                canvas.height = animationParameters.innerHeight;

                const animation = new Animation(ctx, animationParameters)

                if (animationParameters.properties.addByClick) canvas.addEventListener('click', e => animation.particles.push(
                    {
                        ctx: ctx,
                        x: e.data.pos.x,
                        y: e.data.pos.y,
                        velocityX: animation.particles[0].velocityX,
                        velocityY: animation.particles[0].velocityX,
                        life: Math.random()*animation.properties.particleLife*60,
                        start: 0,
                        isStart: true,
                        position: animation.particles[0].position,
                        reCalculateLife: animation.particles[0].reCalculateLife,
                        calcColor: animation.particles[0].calcColor,
                        getColor: animation.particles[0].getColor
                    }
                ) && (animationParameters.properties.isCountStable && animation.particles.shift()))

                animation?.init();
            }
        }
    }, [Animation, animationParameters])
    return canvasRef
}