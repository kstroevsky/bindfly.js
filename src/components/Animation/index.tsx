import React, { lazy, useContext, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { FC } from 'react';

import * as animations from '../../shared/2d/animations';
import DataContext, { IDataContext } from '../Context';
import { Canvas } from '../Canvas';
import { useCanvas } from '../../hooks';
import type { IOutletContext, IProperty } from '../../shared/types';
import type { CanvasAnimationsNames } from '../../router';

const ParamHandlerContainer = lazy(() => import('../ParamHandlerContainer'));

export interface IAnimationProps {
	classId: CanvasAnimationsNames;
	properties: IProperty;
}

const Animation: FC<IAnimationProps> = ({ properties, classId }) => {
	const { keyToggle } = useContext<IDataContext>(DataContext);
	const { width: offset, isMobile } = useOutletContext<IOutletContext>();

	const { innerWidth, innerHeight, devicePixelRatio } = window;
	const offsetWidth: number = isMobile ? 0 : offset;

	const AnimationClass = animations[classId];

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
		<Fragment key={+keyToggle.current}>
			<ParamHandlerContainer
				{...{
					properties,
					handlers,
					classId,
					offsetWidth,
				}}
			/>
			<Canvas
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
		</Fragment>
	);
};

export default React.memo(Animation);
