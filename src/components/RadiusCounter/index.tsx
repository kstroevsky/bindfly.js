import React, { memo, useCallback, useEffect, useState } from 'react'
import type { FC } from 'react'

import { useThrottle } from '../../hooks'
import type { TCallable } from '../../shared/types'

import './styles.css'

export interface IRadiusCounterProps {
    initialValue: number
    onChange: TCallable<void, number>
}

const RadiusCounter: FC<IRadiusCounterProps> = ({ onChange, initialValue }) => {
	const [radius, setRadius] = useState<number>(initialValue)

	const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setRadius(parseInt(e.target.value))
	}, [])

	const changeRadius = useCallback(useThrottle(150, (radius: number) => onChange(radius)), [])

	useEffect(() => {
		changeRadius(radius)
	}, [radius])

	return (
		<>
			<span className={'count'}>Radius: {radius}</span>
			<input
				className={'counter'}
				type={'range'}
				min={0}
				max={initialValue * 3}
				value={radius}
				step={0.5}
				onChange={handleChange}
			/>
		</>
	)
}

export default memo(RadiusCounter)
