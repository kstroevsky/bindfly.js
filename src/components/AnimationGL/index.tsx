import React, { useContext } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { FC } from 'react'

import DataContext, { IDataContext } from '../Context'
import { Canvas } from '../Canvas'
import { useWebGL } from '../../hooks'
import { FlyingCubesGL, FlyingLinesGL } from '../../shared/2d/animations'
import type { IOutletContext, IProperty } from '../../shared/types'

export interface IAnimationGLProps {
	properties: IProperty;
	classId: string;
}

const AnimationGL: FC<IAnimationGLProps> = ({ properties, classId }) => {
	const { keyToggle } = useContext<IDataContext>(DataContext)
	const { width: offset, isMobile } = useOutletContext<IOutletContext>()

	const { innerWidth, innerHeight, devicePixelRatio } = window
	const offsetWidth: number = isMobile ? 0 : offset

	let AnimationClass

	switch (classId) {
		case FlyingCubesGL.name:
			AnimationClass = FlyingCubesGL
			break
		case FlyingLinesGL.name:
		default:
			AnimationClass = FlyingLinesGL
	}

	const canvasRef = useWebGL<typeof AnimationClass>(AnimationClass, {
		properties,
		innerWidth,
		innerHeight,
		devicePixelRatio,
		offset: offsetWidth
	})

	return (
		<Canvas
			key={+keyToggle.current}
			ref={canvasRef}
			width={innerWidth - offsetWidth}
			height={innerHeight}
			style={{
				// backgroundColor: properties.bgColor,
				width: innerWidth - offsetWidth,
				height: innerHeight,
				position: 'absolute',
				right: 0
			}}
		/>
	)
}

export default React.memo(AnimationGL)
