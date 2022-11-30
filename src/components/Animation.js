import React, { useEffect } from "react";
import { Particles } from "./canvas/animations/Particles";
import { useCanvas } from "../hooks";

function Animation({ properties }) {
  const { innerWidth, innerHeight } = window;
  // let canvasRef = useCanvas(null);

  console.log(properties);

  const path = window.location.pathname;

  useEffect(() => {
    console.log(window.location.pathname);
  }, [path]);

  const canvasRef = useCanvas(Particles, {
    properties,
    innerWidth,
    innerHeight,
  });

  return (
    <canvas
      ref={canvasRef}
      style={{
        background: properties.bgColor,
      }}
      width={innerWidth}
      height={innerHeight}
    />
  );
}

export default React.memo(Animation);
