import React, { useContext, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import DropDownContent from "../DropDownContent/DropDownContent";
import { canvasReload } from "../utils";
import DataContext from "./Context";
import ToggleButton from "./ToggleButton";

const LinkItem = ({ propertySets, id }) => {
  const [checked, setChecked] = useState(false);
  const location = useLocation();
  const navPath = `/animation-${id}`;
  const { keyToggle, webWorker } = useContext(DataContext);

  const handleChange = () => {
    setChecked(!checked);
  };

  return (
    <li key={`${id}`} className="ListLinkItem">
      {/* <Link to={`/animation-${id}`}>{`Animation-${id}`}</Link> */}
      <NavLink
        {...(location.pathname === navPath
          ? {
              onClick: (e) => e.preventDefault(),
            }
          : {
              onClick: () => canvasReload(keyToggle, webWorker.current),
              to: navPath,
            })}
        style={({ isActive }) =>
          isActive
            ? {
                color: "white",
                cursor: "default",
                textDecoration: "none",
              }
            : {}
        }
      >
        {`Animation-${id}`}
      </NavLink>
      <ToggleButton keyInput={id} value={checked} onChange={handleChange} />
      {!!checked && <DropDownContent propertySets={propertySets} />}
    </li>
  );
};

export default LinkItem;
