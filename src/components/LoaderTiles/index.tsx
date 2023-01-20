import React from 'react'
import type { FC } from 'react'

import '../Loader/styles.css'

const GUTTER = 5 // Spacing in percentage between tiles
const TRANSITION = 0.2 // Seconds to actually move one block

export interface ILoaderTilesProps {
	radioCommand: string | null;
	position: number;
}

export const LoaderTiles: FC<ILoaderTilesProps> = ({ radioCommand, position }) => {
	const clipPathForPosition = (position: string | number) => {
		const newPosition = parseInt(position as string, 10)
		const SIZE = (100 - 2 * GUTTER) / 3

		const VAR0 = '0% '
		const VAR1 = `${SIZE + GUTTER}% `
		const VAR2 = `${2 * SIZE + 2 * GUTTER}% `

		switch (newPosition) {
			case 0:
				return 'inset(' + VAR1 + VAR2 + VAR1 + VAR0 + ' round 5%)'
			case 1:
				return 'inset(' + VAR0 + VAR2 + VAR2 + VAR0 + ' round 5%)'
			case 2:
				return 'inset(' + VAR0 + VAR1 + VAR2 + VAR1 + ' round 5%)'
			case 3:
				return 'inset(' + VAR1 + VAR1 + VAR1 + VAR1 + ' round 5%)'
			case 4:
				return 'inset(' + VAR2 + VAR1 + VAR0 + VAR1 + ' round 5%)'
			case 5:
				return 'inset(' + VAR2 + VAR0 + VAR0 + VAR2 + ' round 5%)'
			case 6:
				return 'inset(' + VAR1 + VAR0 + VAR1 + VAR2 + ' round 5%)'
			default:
				return ''
		}
	}

	const tileKey = radioCommand || ''

	return (
		<div
			key={`rect-${tileKey}}`}
			className={`rect ${tileKey}`}
			style={{
				transition: `${TRANSITION}s cubic-bezier(0.86, 0, 0.07, 1)`,
				WebkitClipPath: clipPathForPosition(position)
			}}
		/>
	)
}
