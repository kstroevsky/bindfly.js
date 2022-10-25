import React from "react";
import {useEffect, useRef} from "react";
import {Particles} from './canvas/Particles';

function Animation() {
    const canvasRef = useRef(null);
    let w = window.innerWidth;
    let h = window.innerHeight;

    const particles = [];
    const properties = {
        bgColor: 'rgb(17,17,19)',
        particleColor: 'rgb(255,40,40,1)',
        particleRadius: 3,
        particleCount: 30,
        particleMaxVelocity: 0.2,
        lineLength: 150,
        particleLife: 20
    };

    useEffect(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas && canvas.getContext('2d');
            canvas.width = w;
            canvas.height = h;
            if(ctx) {
                const animation = new Particles(ctx, properties, particles, w, h)
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
            width={w}
            height={h}
        />
  );
}

export default React.memo(Animation);
