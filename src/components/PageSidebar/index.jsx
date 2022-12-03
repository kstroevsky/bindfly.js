import React from 'react';
import classNames from "classnames";
import NavLinkItem from '../NavLinkItem';

export const PageSidebar = ({ properties, isModal, isActive = false, onClose = null }) => {

    return (
        <aside className={classNames("sidebar", { 'active': isModal && isActive })}>
            <nav>
                <ul className="ListLink">
                    {properties?.map((item, idx) => (
                        <NavLinkItem
                            key={idx}
                            id={idx}
                            propertySets={item}
                            onCleanUp={onClose}
                        />
                    ))}
                </ul>
            </nav>
            {isModal
                ? (
                    <button className="CloseButton" onClick={onClose}>
                        Close
                    </button>
                ) : <></>
            }

        </aside>
    )
}