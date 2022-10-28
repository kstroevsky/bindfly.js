import React, {useState} from "react";
import {useEffect, useRef} from "react";
import {Particles} from './canvas/animations/Particles';
import {useAnimation} from "../hooks/useAnimation";

function Animation({properties}) {
    // const [isLoaded, setIsLoaded] = useState(false);
    // const canvasRef = useRef(null);
    const {innerWidth, innerHeight} = window;

     const canvasRef = useAnimation(Particles, { properties, innerWidth, innerHeight});
    // console.log(isAnimated)
    // useEffect(() => {
    //     setIsLoaded(!!canvasRef.current)
    // }, [canvasRef.current])

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
            {/*  <CanvasElement />*/}
          </>
      );
}

export default React.memo(Animation);
