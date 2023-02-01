import React, { lazy, useContext } from 'react'
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

const RadiusCounter = lazy(() => import('../RadiusCounter'))
const ParticlesCounter = lazy(() => import('../ParticlesCounter'))
const VelocityCounter = lazy(() => import('../VelocityCounter'))
const LineLengthCounter = lazy(() => import('../LineLengthCounter'))

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
			<div
				key={`${+keyToggle.current}-ranges`}
				className={'animation-handlers'}
			>
				<ParticlesCounter
					key={`${+keyToggle.current}-particles`}
					initialValue={properties.particleCount}
					onChange={changeParticlesCount}
				/>
				{classId !== SpiralFlyingLines.name && (
					<LineLengthCounter
						key={`${+keyToggle.current}-length`}
						initialValue={properties.lineLength}
						onChange={changeLineLength}
					/>
				)}
				{classId !== Spiral.name && classId !== SpiralFlyingLines.name && (
					<VelocityCounter
						key={`${+keyToggle.current}-velocity`}
						initialValue={properties.particleMaxVelocity}
						onChange={changeVelocity}
					/>
				)}
				{classId === SpiralFlyingLines.name &&
					properties.radius &&
					!properties.isPulsative && (
					<RadiusCounter
						key={`${+keyToggle.current}-radius`}
						initialValue={properties.radius || 0}
						onChange={changeRadius}
					/>
				)}
			</div>
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
