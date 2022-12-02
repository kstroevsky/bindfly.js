import React from "react";
import DropDownContentItem from "./DropDownContentItem";

const DropDownContent = ({ propertySets }) => {
  return (
    <ul className="DropDownContent">
      {Object.keys(propertySets).map((property, idx) => (
        <DropDownContentItem key={idx} {...{ propertySets, property }} />
      ))}
    </ul>
  );
};

export default DropDownContent;
