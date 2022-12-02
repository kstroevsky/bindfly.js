import React, { useContext, useState } from "react";
import { LinkProps, NavLink, useLocation } from "react-router-dom";
import DropDownContent from "../DropDownContent/DropDownContent";
import { canvasReload } from "../utils";
import { IDataContext, IProperty } from "../utils/types";
import DataContext from "./Context";
import ToggleButton from "./ToggleButton";

interface ILinkItemProps {
  propertySets: IProperty,
  id: number
}

const LinkItem : React.FC<ILinkItemProps> = ({ propertySets, id }) => {
  const [checked, setChecked] = useState<boolean>(false);
  const location = useLocation();
  const navPath: string = `/animation-${id}`;
  const { keyToggle, webWorker } = useContext<IDataContext>(DataContext);

  const handleChange = () => {
    setChecked(!checked);
  };

  return (
    <li key={`${id}`} className="ListLinkItem">
      <NavLink
        {...(location.pathname === navPath
          ? {
              onClick: (e) => e.preventDefault(),
            }
          : {
              onClick: () => canvasReload(keyToggle, webWorker.current),
              to: navPath,
            }) as LinkProps}
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
