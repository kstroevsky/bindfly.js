import React, { useContext } from "react";
import { FlyingLines } from "../../shared/2d/animations/FlyingLines";
import { useCanvas } from "../../hooks";
import { Canvas } from "../Canvas";
import DataContext from "../Context";
import { IDataContext, IProperty } from '../../utils/types'

interface IProps {
  properties: IProperty
}

const Animation: React.FC<IProps> = ({ properties }) => {
  const { keyToggle } = useContext<IDataContext>(DataContext);
  const { innerWidth, innerHeight } = window;

  const canvasRef = useCanvas<typeof FlyingLines>(FlyingLines, {
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
      }}
    />
  );
};

export default Animation;
