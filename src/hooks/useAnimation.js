import React, {useEffect, useRef, useState} from "react";

export const useAnimation = (Animation, animationParameters) => {
    const [animation, setAnimation] = useState();
    const workerRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../components/canvas/worker.js', import.meta.url));
        workerRef.current.onerror = (event) => {
            workerRef.current.terminate();
        }

        if (canvasRef.current){
                const canvas = canvasRef.current;
                const ctx = canvas && canvas.getContext('2d');
                canvas.width = animationParameters.innerWidth;
                canvas.height = animationParameters.innerHeight;
                const animation = new Animation(ctx, animationParameters)

                setAnimation(animation)
        }
    }, [])

    return {canvasRef, animation};
}