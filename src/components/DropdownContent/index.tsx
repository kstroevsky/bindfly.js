import React, { useCallback, useState } from 'react';
import type { FC } from 'react';

import DropdownItem from '../DropdownItem';
import CopyIcon from '../../assets/copyIcon.svg';
import { COPY_ANIMATION_DURATION } from '../../shared/constants';
import type { IProperty, TValues } from '../../shared/types';

export interface IDropdownContent {
	propertySet: IProperty;
}

const DropdownContent: FC<IDropdownContent> = ({ propertySet }) => {
	const [isCopied, setIsCopied] = useState(false);

	const onListClick = useCallback(() => {
		navigator.clipboard.writeText(JSON.stringify(propertySet, null, '\t'));
		setIsCopied(true);

		setTimeout(() => {
			setIsCopied(false);
		}, COPY_ANIMATION_DURATION);
	}, [propertySet]);

	return (
		<ul className="DropdownContent">
			<CopyIcon
				width={16}
				height={16}
				fill={isCopied ? '#36c373' : 'white'}
				className="Clipboard"
				onClick={onListClick}
			/>
			{Object.entries<TValues<IProperty>>(propertySet).map(
				(
					[propertyKey, propertyValue]: [string, TValues<IProperty>],
					idx: number
				) => (
					<DropdownItem key={idx} {...{ propertyKey, propertyValue }} />
				)
			)}
		</ul>
	);
};

export default React.memo(DropdownContent);
