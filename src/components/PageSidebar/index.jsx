import React, { forwardRef, useCallback } from 'react';
import classNames from "classnames";

import NavLinkItem from '../NavLinkItem';
import { useLongPress } from '../../hooks';
import { isLayoutActive } from '../../shared/utils';
import { root } from "../..";

export const PageSidebar = forwardRef(({ properties, isModal = false }, ref) => {
    const { touchInterval, setTouchInterval } = useLongPress(500, root, isModal);

    const handleClose = useCallback(() => {
        setTouchInterval({ start: 0, end: 0 })
    }, [])

    return (
        <aside
            ref={ref}
            className={classNames("sidebar", { 'active': isModal && isLayoutActive(touchInterval.start, touchInterval.end) })}
        >
            <nav>
                <ul className="ListLink">
                    {properties?.map((item, idx) => (
                        <NavLinkItem
                            key={`an-link-${idx}`}
                            id={idx}
                            propertySets={item}
                            onCleanUp={handleClose}
                        />
                    ))}
                </ul>
            </nav>
            {isModal
                ? (
                    <button className="CloseButton" onClick={handleClose}>
                        Close
                    </button>
                ) : <></>
            }

        </aside>
    )
})