import React, { FC, useCallback, useState } from 'react'
import { COPY_ANIMATION_DURATION } from '../../shared/constants'
import { IProperty, TPropertiesValues } from '../../shared/types'
import DropdownItem from '../DropdownItem'
import CopyIcon from '../../assets/copyIcon.svg'

export interface IDropdownContent {
	propertySet: IProperty;
}

const DropdownContent: FC<IDropdownContent> = ({ propertySet }) => {
	const [isCopied, setIsCopied] = useState(false)

	const onListClick = useCallback(() => {
		navigator.clipboard.writeText(JSON.stringify(propertySet, null, '\t'))
		setIsCopied(true)

		setTimeout(() => {
			setIsCopied(false)
		}, COPY_ANIMATION_DURATION)
	}, [propertySet])

	return (
		<ul className="DropdownContent">
			<CopyIcon
				width={16}
				height={16}
				fill={isCopied ? '#36c373' : 'white'}
				className="Clipboard"
				onClick={onListClick}
			/>
			{Object.entries<TPropertiesValues>(propertySet).map(
				([propertyKey, propertyValue]: [string, TPropertiesValues], idx: number) => (
					<DropdownItem key={idx} {...{ propertyKey, propertyValue }} />
				)
			)}
		</ul>
	)
}

export default React.memo(DropdownContent)
