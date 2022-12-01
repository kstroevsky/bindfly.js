import React, { useEffect } from "react";
import { Particles } from "./canvas/animations/Particles";
import { useCanvas } from "../hooks";

function Animation({ properties }) {
  const { innerWidth, innerHeight } = window;

  const path = window.location.pathname;

  useEffect(() => {
    // window.location.reload();
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
