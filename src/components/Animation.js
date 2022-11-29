import React from "react";
import { Particles } from "./canvas/animations/Particles";
import { useCanvas } from "../hooks";
import { useOutletContext, useParams } from "react-router-dom";

function Animation({ keyProperties }) {
  const { innerWidth, innerHeight } = window;
  const { properties } = useOutletContext();
  console.log(keyProperties);

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
