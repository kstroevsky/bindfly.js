import React, { lazy, useContext, useEffect, useState } from 'react'
import { Spiral, SpiralFlyingLines } from '../../shared/2d/animations'
import DataContext, { IDataContext } from '../Context'
import { IAnimationProps } from './index'

const RadiusCounter = lazy(() => import('../RadiusCounter'))
const ParticlesCounter = lazy(() => import('../ParticlesCounter'))
const VelocityCounter = lazy(() => import('../VelocityCounter'))
const LineLengthCounter = lazy(() => import('../LineLengthCounter'))

type Props = {
  changeParticlesCount: any,
  changeRadius: any,
  changeVelocity: any,
  changeLineLength: any
} // which types do we need here

const Controllers: React.FC<IAnimationProps & Props> = ({
	properties,
	classId,
	changeParticlesCount,
	changeRadius,
	changeVelocity,
	changeLineLength,
}) => {
	const [currentRange, setCurrentRange] = useState(0)
	const { keyToggle } = useContext<IDataContext>(DataContext)

	useEffect(() => {
		console.log(123)
		const items = document.querySelector('.animation-handlers')

		if (items) {
			items.children[currentRange].classList.add('active')
		}

		const handleOnClick = (event: React.MouseEvent<HTMLElement>) => {
			const target = event.target as Element

			if (event.currentTarget) {
				const childs = [...event.currentTarget.children]
				childs.forEach((child) => {
					child.classList.remove('active')
				})

				if (target.className === 'count' || target.className === 'counter') {
					target.parentElement?.classList.add('active')
					setCurrentRange(childs.findIndex(item => item.className.includes('active')))
					return
				}

				target.classList.add('active')
				setCurrentRange(childs.findIndex(item => item.className.includes('active')))
			}
		}

		const handleOnMouseOver = (event: React.MouseEvent<HTMLElement>) => {
			const target = event.target as Element

			if (event.currentTarget) {
				const childs = [...event.currentTarget.children]
				childs.forEach((child) => child.classList.remove('active'))

				if (target.className === 'count' || target.className === 'counter') {
					target.parentElement?.classList.add('active')
					return
				}

				target.classList.add('active')
			}
		}

		const handleOnMouseOut = (event: React.MouseEvent<HTMLElement>) => {
			if (event.currentTarget && items) {
				const childs = [...event.currentTarget.children]
				childs.forEach((child) => child.classList.remove('active'))
				items.children[currentRange].classList.add('active')
			}
		}

		if (items) {
			items.addEventListener('click', handleOnClick)

			items.addEventListener('mouseover', handleOnMouseOver)

			items.addEventListener('mouseout', handleOnMouseOut)
		}

		return () => {
			items.removeEventListener('click', handleOnClick)

			items.removeEventListener('mouseover', handleOnMouseOver)

			items.removeEventListener('mouseout', handleOnMouseOut)
		}
	}, [currentRange, classId])

	return (
		<div
			key={`${+keyToggle.current}-ranges`}
			className={'animation-handlers'}
		>
			<div className='animation-handlers__item'>
				<ParticlesCounter
					key={`${+keyToggle.current}-particles`}
					initialValue={properties.particleCount}
					onChange={changeParticlesCount}
				/>
			</div>

			{classId !== SpiralFlyingLines.name && (
				<div className='animation-handlers__item'>
					<LineLengthCounter
						key={`${+keyToggle.current}-length`}
						initialValue={properties.lineLength}
						onChange={changeLineLength}
					/>
				</div>
			)}

			{classId !== Spiral.name && classId !== SpiralFlyingLines.name && (
				<div className='animation-handlers__item'>
					<VelocityCounter
						key={`${+keyToggle.current}-velocity`}
						initialValue={properties.particleMaxVelocity}
						onChange={changeVelocity}
					/>
				</div>
			)}

			{classId === SpiralFlyingLines.name &&
        properties.radius &&
        !properties.isPulsatile && (
				<div className='animation-handlers__item'>
					<RadiusCounter
						key={`${+keyToggle.current}-radius`}
						initialValue={properties.radius || 0}
						onChange={changeRadius}
					/>
				</div>
			)}

		</div>
	)
}

export default React.memo(Controllers)