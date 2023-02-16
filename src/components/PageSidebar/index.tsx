import classNames from 'classnames';
import React, { forwardRef, useCallback } from 'react';

import root from '../..';
import NavLinkItem from '../NavLinkItem';
import { useLongPress } from '../../hooks';
import { isLayoutActive } from '../../shared/utils/helpers';
import type { IProperty, TProperties } from '../../shared/types';

export interface IPageSidebarProps {
	properties: TProperties;
	isModal: boolean;
}

const PageSidebar = forwardRef<HTMLElement, IPageSidebarProps>(
	({ properties, isModal = false }, ref) => {
		const { touchInterval, setTouchInterval } = useLongPress(
			500,
			document.getElementById('canvas') || root,
			isModal
		);
		const mobileVisibility =
			isModal && isLayoutActive(touchInterval.start, touchInterval.end);

		const handleClose = useCallback(() => {
			setTouchInterval({ start: 0, end: 0 });
		}, [setTouchInterval]);

		return (
			<aside
				ref={ref}
				className={classNames('sidebar', {
					modal: isModal,
					active: mobileVisibility,
				})}
			>
				<nav>
					<ul className="ListLink">
						{properties?.map((item: IProperty, idx: number) => (
							<NavLinkItem
								key={`an-link-${idx}`}
								id={idx}
								propertySet={item}
								onCleanUp={handleClose}
							/>
						))}
					</ul>
				</nav>
				{isModal ? (
					<button className="CloseButton" onClick={handleClose}>
						Close
					</button>
				) : (
					<></>
				)}
			</aside>
		);
	}
);

export default React.memo(PageSidebar);
