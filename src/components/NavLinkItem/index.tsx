import React, { FC, useState } from "react";
import { LinkProps, NavLink, useLocation } from "react-router-dom";
import classNames from "classnames";

import DropDownContent from "../DropdownContent";
import ToggleButton from "../ToggleButton";
import { IProperty } from "../../shared/types";

export interface INavLinkItemProps {
  id: number
  propertySet: IProperty
  onCleanUp: () => void
}

const NavLinkItem: FC<INavLinkItemProps> = ({ id, propertySet, onCleanUp }) => {
  const [checked, setChecked] = useState<boolean>(false);
  const location = useLocation();
  const navPath: string = `/animation-${id}`;

  const handleChange = () => {
    setChecked(!checked);
  };

  return (
    <li className="ListLinkItem">
      <p>
        <NavLink
          {...(location.pathname === navPath
            ? {
              onClick: (e) => e.preventDefault(),
            }
            : {
              onClick: () => onCleanUp?.(),
              to: navPath,
            }) as LinkProps}
          className={({ isActive }) => classNames({ "current-page": isActive })
          }
        >
          {`Animation-${id}`}
        </NavLink>
        <ToggleButton keyInput={id} value={checked} onChange={handleChange} />
      </p>
      {checked && <DropDownContent propertySet={propertySet} />}
    </li>
  );
};

export default NavLinkItem;