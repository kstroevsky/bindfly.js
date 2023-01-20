import classNames from 'classnames'
import React, { useEffect, useRef, useState } from 'react'
import type { FC } from 'react'

import { LoaderTiles } from '../LoaderTiles'

import './styles.css'

const TIMER = 250 // Milliseconds between moving the next block
const DEF_SIZE = 60 // Pixels height/width

export interface ILoaderState {
	positions: Array<string | null>;
	stateNumber: number;
}

export interface ILoaderProps {
	size?: number;
	style?: Record<string, unknown>;
	center?: boolean;
}

const initialState: ILoaderState = {
	positions: ['alpha', 'bravo', 'charlie', null, 'delta', 'echo', 'foxtrot'],
	stateNumber: 0
}

const Loader: FC<ILoaderProps> = ({ size, style, center }) => {
	const timer = useRef<NodeJS.Timer>()
	const [state, setState] = useState<ILoaderState>(initialState)

	const tileIndexToMove = (state: ILoaderState) =>
		state.stateNumber === 7 ? 4 : state.stateNumber % state.positions.length

	const positionForTile = (
		positions: ILoaderState['positions'],
		radioCommand: string | null
	) => positions.findIndex((position: string | null) => position === radioCommand)

	const setNextState = () =>
		setState((prev) => {
			const indexToMove = tileIndexToMove(prev)
			const currentPositions = [...prev.positions]

			currentPositions[positionForTile(currentPositions, null)] =
				prev.positions[indexToMove]
			currentPositions[indexToMove] = null

			return {
				positions: [...currentPositions],
				stateNumber: +(prev.stateNumber === 7 ? 0 : prev.stateNumber + 1)
			}
		})

	const setTimer = (time: number) => {
		timer.current && clearInterval(timer.current)
		timer.current = setInterval(setNextState, time)
	}

	useEffect(() => {
		setTimer(TIMER)
		return () => clearInterval(timer.current)
	})

	return (
		<div
			className={classNames('sw-loader__wrapper', {
				'sw-loader__wrapper--center': center
			})}
			style={Object.assign(
				{
					width: `${size || DEF_SIZE}px`,
					height: `${size || DEF_SIZE}px`
				},
				style
			)}>
			<div className={'sw-loader__holder'}>
				{initialState.positions.map(
					(radioCommand: string | null) =>
						radioCommand === null || (
							<LoaderTiles
								key={`${radioCommand}-loader`}
								{...{
									radioCommand,
									position: positionForTile(state.positions, radioCommand)
								}}
							/>
						)
				)}
			</div>
		</div>
	)
}

export default Loader
