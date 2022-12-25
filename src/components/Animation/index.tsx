import React, { FC, useContext } from 'react'
import { useOutletContext } from 'react-router-dom'

import { useCanvas } from '../../hooks'
// import * as animations from '../shared/2d/animations'
import FlyingLines from '../../shared/2d/animations/FlyingLines'
import SpiralFlyingLines from '../../shared/2d/animations/SpiralFlyingLines'
import { IOutletContext, IProperty } from '../../shared/types'
import { Canvas } from '../Canvas'
import DataContext, { IDataContext } from '../Context'

export interface IAnimationProps {
	classId: string;
	properties: IProperty;
}

const Animation: FC<IAnimationProps> = ({ properties, classId }) => {
	const { keyToggle } = useContext<IDataContext>(DataContext)
	const { width: offset, isMobile } = useOutletContext<IOutletContext>()

	const { innerWidth, innerHeight, devicePixelRatio } = window
	const offsetWidth: number = isMobile ? 0 : offset

	const AnimationClass = classId === SpiralFlyingLines.name ? SpiralFlyingLines : FlyingLines

	const canvasRef = useCanvas<typeof AnimationClass>(AnimationClass, {
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
				backgroundColor: properties.bgColor,
				width: innerWidth - offsetWidth,
				height: innerHeight,
				position: 'absolute',
				right: 0
			}}
		/>
	)
}

export default Animation
