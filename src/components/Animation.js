import React from "react";
import {useEffect, useRef} from "react";
import {Particles} from './canvas/Particles';
import {useAnimation} from "../hooks/useAnimation";

function Animation({properties}) {
    const workerRef = useRef(null);

    const {innerWidth, innerHeight} = window;

    const particles = [];

     const {canvasRef, animation} = useAnimation(Particles, {particles, properties, innerWidth, innerHeight});

    useEffect(() => {
        workerRef.current = new Worker(new URL('./canvas/worker.js', import.meta.url));
        if (canvasRef.current){
            try {
                const offscreen = canvasRef.current.transferControlToOffscreen();
                console.log(offscreen);
                workerRef.current.postMessage(
                    {
                        msg: 'init',
                        canvas: offscreen,
                        animationParameters: {particles, properties, innerWidth, innerHeight}
                    },
                    [offscreen]
                );
            } catch {
                animation?.init();
                animation?.loop();
            }
        }
    }, [animation])

  return (
        <canvas
            ref={canvasRef}
            style={{
                background: properties.bgColor
            }}
            width={innerWidth}
            height={innerHeight}
        />
  );
}

export default React.memo(Animation);
