import React, {useEffect, useRef} from "react";

export const useAnimation = (ref, Animation, animationParameters) => {
    const workerRef = useRef(null);
    let offscreen;
    useEffect(() => {
        workerRef.current = new Worker(new URL('../components/canvas/worker.js', import.meta.url));
        // workerRef.current.onerror = (event) => {
        //     workerRef.current.terminate();
        // }

        if (ref && !offscreen){
            console.log('ok')
            try {
                offscreen = ref.transferControlToOffscreen();
                console.log(offscreen);
                workerRef.current.postMessage(
                    {
                        msg: 'init',
                        canvas: offscreen,
                        animation: Animation,
                        animationParameters: animationParameters
                    },
                    [offscreen]
                );
            } catch {
                const canvas = ref;
                const ctx = canvas.getContext('2d');
                canvas.width = animationParameters.innerWidth;
                canvas.height = animationParameters.innerHeight;
                const animation = new Animation(ctx, animationParameters)
                console.log(animation)
                try {
                    animation?.init();
                    animation?.loop();
                    return true
                } catch {
                    return false
                }

            }
        }
    }, [ref])
}