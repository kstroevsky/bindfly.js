import React, { useEffect, useState } from "react";
import { Particles } from "./canvas/animations/Particles";
import { useCanvas } from "../hooks";
import { useNavigate } from "react-router-dom";

function Animation({ properties }) {
  const { innerWidth, innerHeight } = window;

  const canvasRef = useCanvas(Particles, {
    properties,
    innerWidth,
    innerHeight,
  });

  console.log('11', canvasRef)

  // const [canvas, setCanvas] = useState(null)

  // useEffect(() => {
  //   setCanvas(React.cloneElement(<canvas
  //     ref={canvasRef}
  //     style={{
  //       background: properties.bgColor,
  //     }}
  //     width={innerWidth}
  //     height={innerHeight}
  //   />, { ref: canvasRef }, null))
  // }, [])

  return (
    <>
      <canvas
        ref={canvasRef[0].current ? canvasRef[1] : canvasRef[0]}
        style={{
          background: properties.bgColor,
        }}
        width={innerWidth}
        height={innerHeight}
      />
    </>
  );
}

export default Animation;
