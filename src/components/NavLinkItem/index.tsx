import React, { useCallback, useState } from 'react';
import classNames from 'classnames';
import { NavLink } from 'react-router-dom';
import type { LinkProps } from 'react-router-dom';
import type { FC } from 'react';

import * as animations from '../../shared/2d/animations';
import DropDownContent from '../DropdownContent';
import ToggleButton from '../ToggleButton';
import type { IProperty } from '../../shared/types';

export interface INavLinkItemProps {
	id: number;
	propertySet: IProperty;
	onCleanUp: () => void;
}

const NavLinkItem: FC<INavLinkItemProps> = ({ id, propertySet, onCleanUp }) => {
	const [checked, setChecked] = useState<boolean>(false);

	const handleChange = useCallback(() => {
		setChecked(!checked);
	}, [checked]);

	return (
		<li className="ListLinkItem">
			<p>{`${propertySet.name}`}</p>
			{Object.values(animations).map(
				(x, i) =>
					(Object.hasOwn(propertySet, 'for')
						? Array.isArray(propertySet.for)
							? propertySet.for.includes(x.name)
							: propertySet.for === x.name
						: true) && (
						<p key={`${x.name}-${i}`}>
							<NavLink
								{...((window.location.pathname ===
									`/${x.name}-${propertySet.name.replaceAll(' ', '')}`
									? {
										onClick: (e) => e.preventDefault(),
									}
									: {
										onClick: () => onCleanUp?.(),
										to: {
											pathname: `/${x.name}-${propertySet.name.replaceAll(' ', '')}`,
											search: ''
										},
									}) as LinkProps)}
								className={({ isActive }) =>
									classNames({ 'current-page': isActive })
								}
							>
								{`${x.name}`}
							</NavLink>
						</p>
					)
			)}
			<ToggleButton keyInput={id} value={checked} onChange={handleChange} />
			{checked && <DropDownContent propertySet={propertySet} />}
		</li>
	);
};

export default React.memo(NavLinkItem);
