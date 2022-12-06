import React from "react";
import DropdownItem from "../DropdownItem";

const DropdownContent = ({ propertySets }) => {
  return (
    <ul className="DropdownContent">
      {Object.keys(propertySets).map((property, idx) => (
        <DropdownItem key={idx} {...{ propertySets, property }} />
      ))}
    </ul>
  );
};

export default DropdownContent;
