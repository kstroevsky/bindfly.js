import React, { useContext } from "react";

import { FlyingLines } from "../../shared/2d/animations/FlyingLines";
import { useCanvas } from "../../hooks";
import { Canvas } from '../Canvas'
import { DataContext } from "../Context";
import { useOutletContext } from "react-router-dom";

const Animation = ({ properties }) => {
  const { keyToggle } = useContext(DataContext)
  const { width: offset, isMobile } = useOutletContext();
  const { innerWidth, innerHeight } = window;

  const offsetWidth = isMobile ? 0 : offset
  const canvasRef = useCanvas(FlyingLines, {
    properties,
    innerWidth,
    innerHeight,
    offset: offsetWidth,
  });

  return (
    <Canvas
      key={+keyToggle.current}
      ref={canvasRef}
      width={innerWidth - offsetWidth}
      height={innerHeight}
      style={{
        backgroundColor: properties.bgColor,
        width: innerWidth - offsetWidth,
        height: innerHeight,
        position: 'absolute',
        right: 0,
      }}
    />
  )
};

export default Animation;