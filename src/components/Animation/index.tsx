import React, { useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { FC } from 'react';

import DataContext, { IDataContext } from '../Context';
import { Canvas } from '../Canvas';
import { useCanvas } from '../../hooks';

import {
	FlyingLines,
	DroopingLines,
	SpiralFlyingLines,
	Spiral,
} from '../../shared/2d/animations';
import type { IOutletContext, IProperty } from '../../shared/types';
import type { CanvasAnimationsNames } from '../../router';
import ParamHandlerContainer from '../ParamHandlerContainer';

export interface IAnimationProps {
	classId: CanvasAnimationsNames;
	properties: IProperty;
}

const Animation: FC<IAnimationProps> = ({ properties, classId }) => {
	const { keyToggle } = useContext<IDataContext>(DataContext);
	const { width: offset, isMobile } = useOutletContext<IOutletContext>();

	const { innerWidth, innerHeight, devicePixelRatio } = window;
	const offsetWidth: number = isMobile ? 0 : offset;

	let AnimationClass;

	switch (classId) {
		case SpiralFlyingLines.name:
			AnimationClass = SpiralFlyingLines;
			break;
		case Spiral.name:
			AnimationClass = Spiral;
			break;
		case DroopingLines.name:
			AnimationClass = DroopingLines;
			break;
		default:
			AnimationClass = FlyingLines;
	}

	const [canvasRef, handlers] = useCanvas<typeof AnimationClass>(
		AnimationClass,
		{
			properties,
			innerWidth,
			innerHeight,
			devicePixelRatio,
			offset: offsetWidth,
		}
	);

	return (
		<>
			<ParamHandlerContainer
				{...{ properties, handlers, classId, keyToggle: keyToggle.current }}
			/>
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
		</>
	);
};

export default React.memo(Animation);
