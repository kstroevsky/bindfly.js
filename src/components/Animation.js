import React from "react";
import {useEffect, useRef} from "react";
import {Particles} from './canvas/Particles';

function Animation({properties}) {
    const workerRef = useRef(null);
    const canvasRef = useRef(null);

    const {innerWidth, innerHeight} = window;

    const particles = [];

    useEffect(() => {
        workerRef.current = new Worker(new URL('./canvas/worker.js', import.meta.url));
        if (canvasRef.current){
            try {
                const offscreen = canvasRef.current.transferControlToOffscreen();
                workerRef.current.postMessage(
                    {
                        msg: 'init',
                        canvas: offscreen,
                        innerWidth,
                        innerHeight,
                        properties,
                        particles
                    },
                    [offscreen]
                );
            } catch {
                const canvas = canvasRef.current;
                const ctx = canvas && canvas.getContext('2d');
                canvas.width = innerWidth;
                canvas.height = innerHeight;
                const animation = new Particles(ctx, properties, particles, innerWidth, innerHeight)
                animation.init();
                animation.loop();
            }
        }
    }, [])

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
