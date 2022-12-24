import classNames from 'classnames'
import React, { FC, useCallback, useState } from 'react'
import { COPY_ANIMATION_DURATION } from '../../shared/constants'
import { TPropertiesValues } from '../../shared/types'
import { parametersToString } from '../../shared/utils'

export interface IDropdownItemProps {
	propertyKey: string;
	propertyValue: TPropertiesValues;
}

const DropdownItem: FC<IDropdownItemProps> = ({ propertyKey, propertyValue }) => {
	const [isCopied, setIsCopied] = useState(false)

	const onItemClick = useCallback(() => {
		navigator.clipboard.writeText(
			`${propertyKey}: ${parametersToString(propertyValue)}`
		)
		setIsCopied(true)

		setTimeout(() => {
			setIsCopied(false)
		}, COPY_ANIMATION_DURATION)
	}, [propertyKey, propertyValue])

	return (
		<li className="CardPanel" onClick={onItemClick}>
			<p>
				{`${propertyKey}: `}
				<span className={classNames({ CardPanel_Copied: isCopied })}>
					{parametersToString(propertyValue)}
				</span>
			</p>
		</li>
	)
}

export default DropdownItem
