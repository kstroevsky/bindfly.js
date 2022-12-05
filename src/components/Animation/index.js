import React, { useContext } from "react";

import { FlyingLines } from "../../shared/2d/animations/FlyingLines";
import { useCanvas } from "../../hooks";
import { Canvas } from '../Canvas'
import { DataContext } from "../Context";
import { useOutletContext } from "react-router-dom";

const Animation = ({ properties }) => {
  const { keyToggle } = useContext(DataContext)
  const { innerWidth, innerHeight } = window;
  const { width: offset } = useOutletContext();

  console.log(offset)

  const canvasRef = useCanvas(FlyingLines, {
    properties,
    innerWidth,
    innerHeight,
    offset,
  });

  return (
    <Canvas
      key={+keyToggle.current}
      ref={canvasRef}
      width={innerWidth - offset}
      height={innerHeight}
      style={{
        backgroundColor: properties.bgColor,
        width: innerWidth - offset,
        height: innerHeight,
        position: 'absolute',
        right: 0,
      }}
    />
  )
};

export default Animation;