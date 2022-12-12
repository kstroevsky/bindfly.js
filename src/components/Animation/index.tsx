import React, { FC, useContext } from "react";
import { useOutletContext } from "react-router-dom";

import FlyingLines from "../../shared/2d/animations/FlyingLines";
import { useCanvas } from "../../hooks";
import { Canvas } from "../Canvas";
import DataContext, { IDataContext } from "../Context";
import { IOutletContext, IProperty } from "../../shared/types";

export interface IAnimationProps {
  properties: IProperty
}

const Animation: FC<IAnimationProps> = ({ properties }) => {
  const { keyToggle } = useContext<IDataContext>(DataContext);
  const { width: offset, isMobile } = useOutletContext<IOutletContext>();
  const { innerWidth, innerHeight } = window;
  const offsetWidth: number = isMobile ? 0 : offset;

  const canvasRef = useCanvas<typeof FlyingLines>(FlyingLines, {
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
        position: "absolute",
        right: 0,
      }}
    />
  );
};

export default Animation;
