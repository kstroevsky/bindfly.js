import React, { useContext } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { FC } from 'react'

import {
	FlyingLines,
	DroopingLines,
	SpiralFlyingLines,
	Spiral,
} from '../../shared/2d/animations'
import DataContext, { IDataContext } from '../Context'
import { useCanvas } from '../../hooks'
import { Canvas } from '../Canvas'
import type { IOutletContext, IProperty } from '../../shared/types'
import Controllers from './Controllers'

export interface IAnimationProps {
	classId: string;
	properties: IProperty;
}

const Animation: FC<IAnimationProps> = ({ properties, classId }) => {
	const { keyToggle } = useContext<IDataContext>(DataContext)
	const { width: offset, isMobile } = useOutletContext<IOutletContext>()

	const { innerWidth, innerHeight, devicePixelRatio } = window
	const offsetWidth: number = isMobile ? 0 : offset

	let AnimationClass

	switch (classId) {
		case SpiralFlyingLines.name:
			AnimationClass = SpiralFlyingLines
			break
		case Spiral.name:
			AnimationClass = Spiral
			break
		case DroopingLines.name:
			AnimationClass = DroopingLines
			break
		default:
			AnimationClass = FlyingLines
	}

	const [
		canvasRef,
		changeParticlesCount,
		changeRadius,
		changeVelocity,
		changeLineLength,
	] = useCanvas<typeof AnimationClass>(AnimationClass, {
		properties,
		innerWidth,
		innerHeight,
		devicePixelRatio,
		offset: offsetWidth,
	})

	return (
		<>
			{
				AnimationClass && (
					<Controllers
						changeParticlesCount={changeParticlesCount}
						changeLineLength={changeLineLength}
						changeVelocity={changeVelocity}
						changeRadius={changeRadius}
						properties={properties}
						classId={classId}
					/>
				)
			}
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
	)
}

export default React.memo(Animation)
