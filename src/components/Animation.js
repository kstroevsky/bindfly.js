import React from "react";
import {Particles} from './canvas/animations/Particles';
import {useAnimation} from "../hooks/useAnimation";

function Animation({properties}) {
    const {innerWidth, innerHeight} = window;

     const canvasRef = useAnimation(Particles, { properties, innerWidth, innerHeight});

      return (
          <>
            {!canvasRef.current && <div>Анимациия недоступна</div>}
            <canvas
                ref={canvasRef}
                style={{
                    background: properties.bgColor
                }}
                width={innerWidth}
                height={innerHeight}
            />
          </>
      );
}

export default React.memo(Animation);
