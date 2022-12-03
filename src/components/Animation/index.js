import React, { useContext, useEffect } from "react";

import { FlyingLines } from "../../shared/2d/animations/FlyingLines";
import { useCanvas } from "../../hooks";
import { Canvas } from '../Canvas'
import { DataContext } from "../Context";

const Animation = ({ properties }) => {
  const { keyToggle } = useContext(DataContext)
  const { innerWidth, innerHeight } = window;

  const canvasRef = useCanvas(FlyingLines, {
    properties,
    innerWidth,
    innerHeight,
  });

  return (
    <Canvas
      key={+keyToggle.current}
      ref={canvasRef}
      width={innerWidth}
      height={innerHeight}
      style={{
        backgroundColor: properties.bgColor,
        width: innerWidth,
        height: innerHeight,
        position: 'relative',
        right: 0,
      }}
    />
  )
};

export default Animation;