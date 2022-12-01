import React, { useState } from "react";
import { Link } from "react-router-dom";
import DropDownContent from "../DropDownContent/DropDownContent";
import ToggleButton from "./ToggleButton";

const LinkItem = ({ propertySets, id }) => {
  const [checked, setChecked] = useState(false);

  const handleChange = () => {
    setChecked(!checked);
  };

  return (
    <li key={`${id}`} className="ListLinkItem">
      <Link to={`/animation-${id}`}>{`Animation-${id}`}</Link>
      <ToggleButton keyInput={id} value={checked} onChange={handleChange} />
      {!!checked && <DropDownContent propertySets={propertySets} />}
    </li>
  );
};

export default LinkItem;
