import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import classNames from "classnames";

import DropDownContent from "../DropdownContent";
import ToggleButton from "../ToggleButton";

const NavLinkItem = ({ id, propertySets, onCleanUp }) => {
  const [checked, setChecked] = useState(false);
  const location = useLocation();
  const navPath = `/animation-${id}`;

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
            })}
          className={({ isActive }) => classNames({ "current-page": isActive })
          }
        >
          {`Animation-${id}`}
        </NavLink>
        <ToggleButton keyInput={id} value={checked} onChange={handleChange} />
      </p>
      {checked && <DropDownContent propertySets={propertySets} />}
    </li>
  );
};

export default NavLinkItem;
