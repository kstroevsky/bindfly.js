import React, {useState} from "react";
import {useEffect, useRef} from "react";
import {Particles} from './canvas/Particles';
import {useAnimation} from "../hooks/useAnimation";

function Animation({properties}) {
    const [isLoaded, setIsLoaded] = useState(false);
    const canvasRef = useRef(null);
    const {innerWidth, innerHeight} = window;

     const isAnimated = useAnimation(canvasRef.current, Particles, { properties, innerWidth, innerHeight});

    useEffect(() => {
        setIsLoaded(!!canvasRef.current)
    }, [canvasRef.current])

      return (
          <>
            {!isAnimated && <div>Анимациия недоступна</div>}
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
