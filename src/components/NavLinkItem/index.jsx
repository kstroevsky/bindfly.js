import React, { useContext, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import DropDownContent from "../DropdownContent";
import { canvasReload } from "../../shared/utils";
import { DataContext } from "../Context";
import ToggleButton from "../ToggleButton";
import classNames from "classnames";

const NavLinkItem = ({ id, propertySets, onCleanUp }) => {
  const [checked, setChecked] = useState(false);
  const location = useLocation();
  const navPath = `/animation-${id}`;
  const { keyToggle, webWorker } = useContext(DataContext);

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
              onClick: () => canvasReload(keyToggle, webWorker) || onCleanUp?.(),
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
