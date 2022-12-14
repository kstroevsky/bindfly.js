import classNames from 'classnames';
import React, { forwardRef, useCallback } from 'react';

import root from '../..';
import { useLongPress } from '../../hooks';
import { IProperty, TProperties } from '../../shared/types';
import { isLayoutActive } from '../../shared/utils';
import NavLinkItem from '../NavLinkItem';

export interface IPageSidebarProps {
  properties: TProperties;
  isModal: boolean;
}

export const PageSidebar = forwardRef<HTMLElement, IPageSidebarProps>(
  ({ properties, isModal = false }, ref) => {
    const { touchInterval, setTouchInterval } = useLongPress(500, root, isModal);
    const mobileVisibility =
      isModal && isLayoutActive(touchInterval.start, touchInterval.end);

    const handleClose = useCallback(() => {
      setTouchInterval({ start: 0, end: 0 });
    }, []);

    return (
      <aside
        ref={ref}
        className={classNames('sidebar', {
          modal: isModal,
          active: mobileVisibility
        })}>
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
