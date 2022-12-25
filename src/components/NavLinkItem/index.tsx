import classNames from 'classnames'
import React, { FC, useState } from 'react'
import { LinkProps, NavLink, useLocation } from 'react-router-dom'

import { IProperty } from '../../shared/types'
import DropDownContent from '../DropdownContent'
import ToggleButton from '../ToggleButton'

import * as animations from '../../shared/2d/animations'

export interface INavLinkItemProps {
	id: number;
	propertySet: IProperty;
	onCleanUp: () => void;
}

const NavLinkItem: FC<INavLinkItemProps> = ({ id, propertySet, onCleanUp }) => {
	const [checked, setChecked] = useState<boolean>(false)
	const location = useLocation()

	const handleChange = () => {
		setChecked(!checked)
	}

	return (
		<li className="ListLinkItem">
			<p>{`${propertySet.name}`}</p>
			{Object.values(animations).map((x, i) => (
				<p key={`${x.name}-${i}`}>
					<NavLink
						{...((location.pathname === `/${x.name}-${propertySet.name}`
							? {
								onClick: (e) => e.preventDefault()
							}
							: {
								onClick: () => onCleanUp?.(),
								to: `/${x.name}-${propertySet.name}`
							}) as LinkProps)}
						className={({ isActive }) => classNames({ 'current-page': isActive })}>
						{`${x.name}`}
					</NavLink>
				</p>
			))}
			<ToggleButton keyInput={id} value={checked} onChange={handleChange} />
			{checked && <DropDownContent propertySet={propertySet} />}
		</li>
	)
}

export default NavLinkItem
