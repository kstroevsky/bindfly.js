import React from "react";
import DropDownContentItem from "../DropdownItem";

const DropdownContent = ({ propertySets }) => {
  return (
    <ul className="DropDownContent">
      {Object.keys(propertySets).map((property, idx) => (
        <DropDownContentItem key={idx} {...{ propertySets, property }} />
      ))}
    </ul>
  );
};

export default DropdownContent;
