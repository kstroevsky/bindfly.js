import React, { lazy, useContext, Fragment } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { FC } from 'react';

import * as animations from '../../shared/2d/animations';
import DataContext, { IDataContext } from '../Context';
import { Canvas } from '../Canvas';
import { useWebGL } from '../../hooks';
import { FlyingCubesGL, FlyingLinesGL } from '../../shared/2d/animations';
import type { CanvasAnimationsNames } from '../../router';
import type { IOutletContext, IProperty } from '../../shared/types';
import useWindowSize from '../../hooks/useWindowSize';

const ParamHandlerContainer = lazy(() => import('../ParamHandlerContainer'));

export interface IAnimationGLProps {
	properties: IProperty;
	classId: CanvasAnimationsNames;
}

const AnimationGL: FC<IAnimationGLProps> = ({ properties, classId }) => {
	const { keyToggle } = useContext<IDataContext>(DataContext);
	const { width: offset, isMobile } = useOutletContext<IOutletContext>();

	const { innerWidth, innerHeight, devicePixelRatio } = window;
	const [width, height] = useWindowSize();
	const offsetWidth: number = isMobile ? 0 : offset;

	const AnimationClass = animations[classId];

	const [canvasRef, handlers] = useWebGL(AnimationClass, {
		properties,
		innerWidth,
		innerHeight,
		devicePixelRatio,
		offset: offsetWidth,
	});

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
				width={width - offsetWidth}
				height={height}
				style={{
					width: width - offsetWidth,
					height: height,
					position: 'absolute',
					right: 0,
				}}
			/>
		</Fragment>
	);
};

export default React.memo(AnimationGL);
