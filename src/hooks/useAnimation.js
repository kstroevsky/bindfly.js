import React, {useEffect, useRef} from "react";

export const useAnimation = (Animation,animationParameters) => {
    const workerRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../components/canvas/worker.js', import.meta.url));

        if (canvasRef){
            try {
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
                const ctx = canvas.getContext('2d');
                canvas.width = animationParameters.innerWidth;
                canvas.height = animationParameters.innerHeight;
                const animation = new Animation(ctx, animationParameters)
                console.log(animation)
                try {
                    animation?.init();
                    animation?.loop();
                } catch {}
            }
        }
    }, [Animation])
    return canvasRef
}